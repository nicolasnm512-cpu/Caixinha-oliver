-- PENDENTE: revisar no Supabase correto antes de aplicar.
create table if not exists public.activity_expenses (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  expense_type text not null check (expense_type in ('prize','transport','purchase','cash_prize','other')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  winner_member_id uuid references public.profiles(id) on delete set null,
  winner_name text,
  inventory_status text not null default 'not_applicable'
    check (inventory_status in ('delivered','available','not_applicable')),
  notes text,
  occurred_at date not null default current_date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activity_expenses_activity_id_idx
  on public.activity_expenses(activity_id);

alter table public.activity_expenses enable row level security;

drop policy if exists activity_expenses_admin_select on public.activity_expenses;
create policy activity_expenses_admin_select
on public.activity_expenses for select
to authenticated
using ((select private.is_admin()));

drop policy if exists activity_expenses_admin_insert on public.activity_expenses;
create policy activity_expenses_admin_insert
on public.activity_expenses for insert
to authenticated
with check ((select private.is_admin()) and created_by=(select auth.uid()));

drop policy if exists activity_expenses_admin_update on public.activity_expenses;
create policy activity_expenses_admin_update
on public.activity_expenses for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists activity_expenses_admin_delete on public.activity_expenses;
create policy activity_expenses_admin_delete
on public.activity_expenses for delete
to authenticated
using ((select private.is_admin()));

grant select,insert,update,delete on public.activity_expenses to authenticated;
grant all on public.activity_expenses to service_role;
