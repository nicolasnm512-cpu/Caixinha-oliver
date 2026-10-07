-- Corrige o resumo financeiro do cotista para considerar ajustes auditados
-- sem expor lotes administrativos via RLS.

create or replace function private.get_my_yield_adjustment(p_year integer)
returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
  select round(coalesce(sum(l.delta),0),2)
  from public.yield_adjustment_lines l
  join public.interest_distribution_batches b on b.id=l.batch_id
  where l.member_id=(select auth.uid())
    and extract(year from b.transaction_date)=p_year
    and (select auth.uid()) is not null;
$function$;

revoke all on function private.get_my_yield_adjustment(integer) from public, anon;
grant execute on function private.get_my_yield_adjustment(integer) to authenticated, service_role;

create or replace function public.get_my_member_dashboard(
  p_year integer default extract(year from current_date)::integer
)
returns table(
  year integer,
  paid_contributions numeric,
  interest_yield numeric
)
language sql
security invoker
set search_path = ''
as $function$
with monthly as (
  select coalesce(sum(mc.amount_paid),0) total
  from public.monthly_contributions mc
  where mc.member_id=(select auth.uid())
    and mc.status='confirmed'
    and extract(year from mc.reference_month)=p_year
),
snapshot as (
  select coalesce(max(s.contributions_paid),0) total
  from public.member_year_snapshots s
  where s.member_id=(select auth.uid())
    and s.year=p_year
),
base as (
  select coalesce(sum(d.amount),0) total
  from public.interest_distributions d
  where d.member_id=(select auth.uid())
    and d.distribution_year=p_year
    and d.status='credited'
)
select
  p_year,
  round(greatest((select total from monthly),(select total from snapshot)),2),
  round((select total from base)+private.get_my_yield_adjustment(p_year),2)
where (select auth.uid()) is not null;
$function$;

revoke all on function public.get_my_member_dashboard(integer) from public, anon;
grant execute on function public.get_my_member_dashboard(integer) to authenticated, service_role;
