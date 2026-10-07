-- OLIVER Caixinha — correção histórica confirmada em 2026-10-07
-- Duas primeiras rifas de 2026:
-- Tayná = 3 cotas; Jamaica = 1 cota.
-- A partir de 2026-08-01:
-- Tayná = 1 cota; Jamaica = 3 cotas.
-- Repasse auditado no fechamento consolidado: R$ 310,88 de Jamaica para Tayná.
-- Idempotente: não duplica programação nem ajuste.

do $$
declare
  v_admin uuid;
  v_tayna uuid;
  v_jamaica uuid;
  v_batch uuid;
  v_op uuid;
begin
  select id into v_admin from public.profiles
  where lower(email)=lower('nicolasmenezes103@gmail.com') limit 1;

  select id into v_tayna from public.profiles
  where lower(full_name)=lower('Tayná') limit 1;

  select id into v_jamaica from public.profiles
  where lower(full_name)=lower('Jamaica') limit 1;

  select id into v_batch from public.interest_distribution_batches
  where external_key='manual-profit-2026'
  order by created_at desc limit 1;

  if v_admin is null or v_tayna is null or v_jamaica is null or v_batch is null then
    raise exception 'Pré-requisitos da correção de rifas 2026 não encontrados';
  end if;

  insert into public.member_share_schedule(member_id,effective_from,share_count,reason,created_by)
  select v_tayna,'2026-01-01',3,'Correção histórica confirmada: Tayná tinha 3 cotas nas duas primeiras rifas de 2026.',v_admin
  where not exists(select 1 from public.member_share_schedule where member_id=v_tayna and effective_from='2026-01-01');

  insert into public.member_share_schedule(member_id,effective_from,share_count,reason,created_by)
  select v_tayna,'2026-08-01',1,'A partir da rifa de agosto de 2026, Tayná passa a 1 cota.',v_admin
  where not exists(select 1 from public.member_share_schedule where member_id=v_tayna and effective_from='2026-08-01');

  insert into public.member_share_schedule(member_id,effective_from,share_count,reason,created_by)
  select v_jamaica,'2026-01-01',1,'Correção histórica confirmada: Jamaica tinha 1 cota nas duas primeiras rifas de 2026.',v_admin
  where not exists(select 1 from public.member_share_schedule where member_id=v_jamaica and effective_from='2026-01-01');

  insert into public.member_share_schedule(member_id,effective_from,share_count,reason,created_by)
  select v_jamaica,'2026-08-01',3,'A partir da rifa de agosto de 2026, Jamaica passa a 3 cotas.',v_admin
  where not exists(select 1 from public.member_share_schedule where member_id=v_jamaica and effective_from='2026-08-01');

  select id into v_op
  from public.yield_adjustment_operations
  where batch_id=v_batch
    and target_member_id=v_jamaica
    and requested_amount=310.88
    and mode='transfer'
    and recipient_member_id=v_tayna
  order by created_at desc limit 1;

  if v_op is null then
    v_op:=gen_random_uuid();
    insert into public.yield_adjustment_operations
      (id,batch_id,target_member_id,requested_amount,mode,reserve_amount,recipient_member_id,reason,created_by)
    values
      (v_op,v_batch,v_jamaica,310.88,'transfer',0,v_tayna,
       'Correção confirmada das duas primeiras rifas de 2026: Tayná 3 cotas e Jamaica 1 cota.',v_admin);

    insert into public.yield_adjustment_lines(operation_id,batch_id,member_id,delta)
    values
      (v_op,v_batch,v_jamaica,-310.88),
      (v_op,v_batch,v_tayna,310.88);
  end if;
end $$;
