-- PENDENTE: revisar no Supabase correto antes de aplicar.
-- Regra planejada:
-- 1) taxa administrativa é retirada do juro bruto;
-- 2) saldo líquido é dividido pelas cotas reais + cotas virtuais do ADM;
-- 3) cota virtual não gera aporte mensal, limite, rifa ou passeio;
-- 4) ADM recebe taxa administrativa + valor das cotas virtuais.

alter table public.fund_settings
  add column if not exists interest_admin_fee_percent numeric(7,4) not null default 10,
  add column if not exists admin_virtual_interest_shares integer not null default 1,
  add column if not exists interest_admin_beneficiary_id uuid references public.profiles(id);

alter table public.fund_settings drop constraint if exists fund_settings_interest_admin_fee_check;
alter table public.fund_settings add constraint fund_settings_interest_admin_fee_check
  check (interest_admin_fee_percent between 0 and 100);

alter table public.fund_settings drop constraint if exists fund_settings_virtual_interest_shares_check;
alter table public.fund_settings add constraint fund_settings_virtual_interest_shares_check
  check (admin_virtual_interest_shares >= 0);

alter table public.interest_distribution_batches
  add column if not exists admin_fee_percent numeric(7,4),
  add column if not exists admin_fee_amount numeric(12,2),
  add column if not exists real_share_count integer,
  add column if not exists virtual_share_count integer,
  add column if not exists net_distributable_amount numeric(12,2),
  add column if not exists share_unit_amount numeric(12,2),
  add column if not exists virtual_share_amount numeric(12,2),
  add column if not exists admin_total_amount numeric(12,2),
  add column if not exists admin_beneficiary_id uuid references public.profiles(id);

create or replace function public.calculate_interest_admin_policy(
  p_gross_amount numeric,
  p_real_share_count integer,
  p_fee_percent numeric,
  p_virtual_share_count integer
)
returns table(
  gross_amount numeric,
  admin_fee_amount numeric,
  net_distributable_amount numeric,
  total_distribution_shares integer,
  share_unit_amount numeric,
  virtual_share_amount numeric,
  real_share_pool numeric,
  admin_total_amount numeric
)
language sql
immutable
security invoker
set search_path=''
as $$
  with x as (
    select
      greatest(0,coalesce(p_gross_amount,0))::numeric as gross,
      greatest(0,least(100,coalesce(p_fee_percent,0)))::numeric as fee_pct,
      greatest(0,coalesce(p_real_share_count,0))::integer as real_shares,
      greatest(0,coalesce(p_virtual_share_count,0))::integer as virtual_shares
  ), y as (
    select *,
      round(gross*fee_pct/100,2) as fee,
      round(gross-round(gross*fee_pct/100,2),2) as net,
      real_shares+virtual_shares as total_shares
    from x
  ), z as (
    select *,
      case when total_shares>0 then round(net/total_shares,2) else 0::numeric end as unit
    from y
  )
  select
    gross,
    fee,
    net,
    total_shares,
    unit,
    round(unit*virtual_shares,2),
    round(net-round(unit*virtual_shares,2),2),
    round(fee+round(unit*virtual_shares,2),2)
  from z;
$$;

revoke all on function public.calculate_interest_admin_policy(numeric,integer,numeric,integer) from public,anon;
grant execute on function public.calculate_interest_admin_policy(numeric,integer,numeric,integer) to authenticated;

-- ATENÇÃO:
-- O repositório atual não contém a função/trigger SQL que cria as distribuições individuais.
-- Quando o Supabase correto for conectado, substituir a lógica existente para usar esta função,
-- gravar os campos acima no batch e creditar a cota virtual ao beneficiário configurado.
