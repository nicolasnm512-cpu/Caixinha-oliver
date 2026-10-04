-- PENDENTE: revisar no Supabase correto antes de aplicar.
alter table public.profiles
  add column if not exists loan_limit_override numeric(12,2),
  add column if not exists loan_limit_override_updated_at timestamptz,
  add column if not exists loan_limit_override_updated_by uuid references auth.users(id);

alter table public.profiles drop constraint if exists profiles_loan_limit_override_check;
alter table public.profiles add constraint profiles_loan_limit_override_check
  check (loan_limit_override is null or loan_limit_override >= 0);

create table if not exists public.member_credit_limit_audit (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  previous_override numeric(12,2),
  new_override numeric(12,2),
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);

alter table public.member_credit_limit_audit enable row level security;

drop policy if exists member_credit_limit_audit_admin_select on public.member_credit_limit_audit;
create policy member_credit_limit_audit_admin_select
on public.member_credit_limit_audit for select
to authenticated
using ((select private.is_admin()));

drop policy if exists member_credit_limit_audit_admin_insert on public.member_credit_limit_audit;
create policy member_credit_limit_audit_admin_insert
on public.member_credit_limit_audit for insert
to authenticated
with check ((select private.is_admin()) and changed_by=(select auth.uid()));

grant select,insert on public.member_credit_limit_audit to authenticated;
grant all on public.member_credit_limit_audit to service_role;

-- IMPORTANTE: confirmar a definição real da view no projeto correto.
-- A versão abaixo preserva a regra atual observada no código: contribuições confirmadas + bônus - crédito utilizado.
create or replace view public.member_credit_summary
with (security_invoker=true)
as
with contribution_data as (
  select mc.member_id,
         sum(mc.amount_paid) filter (where mc.status='confirmed') as total_paid,
         bool_or(mc.status='pending' and mc.due_date is not null and mc.due_date<current_date) as has_overdue
  from public.monthly_contributions mc
  group by mc.member_id
),
activity_data as (
  select ae.member_id,
         bool_or(ae.status='pending' and a.ends_at is not null and a.ends_at<current_date) as has_overdue
  from public.activity_entries ae
  join public.activities a on a.id=ae.activity_id
  group by ae.member_id
),
loan_data as (
  select l.member_id,
         sum(l.outstanding_amount) filter (where l.status in ('active','late')) as used_credit,
         bool_or(l.status='late') as has_overdue
  from public.loans l
  group by l.member_id
),
base as (
  select p.id as member_id,
         p.share_count,
         p.share_count>1 as has_multiple_shares,
         coalesce(c.total_paid,0)::numeric(12,2) as eligible_contributions,
         round(coalesce(c.total_paid,0)*(1+fs.credit_bonus_percent/100),2)::numeric(12,2) as automatic_credit_limit,
         p.loan_limit_override,
         coalesce(l.used_credit,0)::numeric(12,2) as used_credit,
         coalesce(c.has_overdue,false) as has_overdue_contributions,
         coalesce(a.has_overdue,false) as has_overdue_activities,
         coalesce(l.has_overdue,false) as has_overdue_loans
  from public.profiles p
  cross join public.fund_settings fs
  left join contribution_data c on c.member_id=p.id
  left join activity_data a on a.member_id=p.id
  left join loan_data l on l.member_id=p.id
  where fs.id=1
)
select member_id,
       share_count,
       has_multiple_shares,
       eligible_contributions,
       coalesce(loan_limit_override,automatic_credit_limit)::numeric(12,2) as credit_limit,
       used_credit,
       greatest(0,coalesce(loan_limit_override,automatic_credit_limit)-used_credit)::numeric(12,2) as available_credit,
       has_overdue_contributions,
       has_overdue_activities,
       has_overdue_loans,
       automatic_credit_limit,
       loan_limit_override,
       case when loan_limit_override is null then 'automatic' else 'custom' end::text as limit_mode
from base;

grant select on public.member_credit_summary to authenticated;

create or replace function public.admin_set_member_credit_limit(p_member_id uuid,p_limit numeric)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_old numeric(12,2);
  v_new numeric(12,2);
begin
  if not (select private.is_admin()) then
    raise exception 'Acesso administrativo necessário.';
  end if;
  if p_limit is not null and p_limit < 0 then
    raise exception 'O limite não pode ser negativo.';
  end if;

  select loan_limit_override into v_old
  from public.profiles
  where id=p_member_id and cotista_number is not null
  for update;

  if not found then raise exception 'Cotista não encontrado.'; end if;

  v_new:=case when p_limit is null then null else round(p_limit,2) end;

  update public.profiles
  set loan_limit_override=v_new,
      loan_limit_override_updated_at=now(),
      loan_limit_override_updated_by=(select auth.uid()),
      updated_at=now()
  where id=p_member_id;

  if v_old is distinct from v_new then
    insert into public.member_credit_limit_audit(member_id,previous_override,new_override,changed_by)
    values(p_member_id,v_old,v_new,(select auth.uid()));
  end if;

  return jsonb_build_object('member_id',p_member_id,'previous_override',v_old,'new_override',v_new);
end;
$$;

revoke all on function public.admin_set_member_credit_limit(uuid,numeric) from public,anon;
grant execute on function public.admin_set_member_credit_limit(uuid,numeric) to authenticated;
