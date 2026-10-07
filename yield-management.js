(() => {
  "use strict";
  const $=s=>document.querySelector(s);
  const box=$('#yieldManagement');
  if(!box)return;
  const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const names=new Map();
  let members=[],schedules=[],raffles=[],eventExpenses=[],batches=[],lastAdjustment=null,lastRaffle=null,loading=false;

  function tell(message){
    if(typeof toast==='function')toast(message);
  }
  function write(id,message,warning=false){
    const el=$(id);if(!el)return;
    el.textContent=message;
    el.classList.toggle('yield-warning',warning);
  }
  function optionList(selector,list,value,label){
    const el=$(selector);if(!el)return;
    const previous=el.value;
    el.replaceChildren(...list.map(item=>{
      const op=document.createElement('option');
      op.value=value(item);op.textContent=label(item);return op;
    }));
    if(list.some(item=>value(item)===previous))el.value=previous;
  }
  function formattedDate(date){
    if(!date)return '—';
    return new Date(date+'T12:00:00').toLocaleDateString('pt-BR');
  }
  function getMember(id){return members.find(m=>m.id===id)}
  function countOn(memberId,date){
    const selected=schedules.filter(s=>s.member_id===memberId&&s.effective_from<=date)
      .sort((a,b)=>b.effective_from.localeCompare(a.effective_from))[0];
    return Number(selected?.share_count??getMember(memberId)?.share_count??0);
  }
  function historicalPreview(){
    const memberId=$('#yieldShareMember').value;
    const effective=$('#yieldEffectiveDate').value;
    const qty=Number($('#yieldShareCount').value);
    const member=getMember(memberId);
    const el=$('#yieldShareHistorical');
    if(!el||!member)return;
    const hypothetical=(id,date)=>{
      if(id===memberId&&effective&&qty>=1&&qty<=20&&Number.isInteger(qty)&&date>=effective)return qty;
      return countOn(id,date);
    };
    let estimatedTotal=0;
    const rows=raffles.filter(r=>r.status==='closed'&&r.ends_at)
      .sort((a,b)=>a.ends_at.localeCompare(b.ends_at)).map(a=>{
        const myShares=hypothetical(memberId,a.ends_at);
        const realShares=members.reduce((sum,m)=>sum+hypothetical(m.id,a.ends_at),0);
        const virtual=Math.max(1,Number(state.settings?.admin_virtual_interest_shares||1));
        const fees=Number(state.settings?.interest_admin_fee_percent??10);
        const paidCost=eventExpenses.filter(e=>e.activity_id===a.id)
          .reduce((sum,e)=>sum+Number(e.amount||0),0);
        const gross=Math.max(0,Number(a.target_amount||0)-paidCost);
        const grossCents=Math.round(gross*100);
        const feeCents=Math.round(grossCents*fees/100);
        const perShareCents=realShares>0?Math.floor((grossCents-feeCents)/(realShares+virtual)):0;
        const receivedCents=perShareCents*myShares;
        estimatedTotal+=receivedCents;
        return a.title+': '+myShares+' cota(s), estimativa '+fmt.format(receivedCents/100);
      });
    el.textContent='SIMULAÇÃO POR RIFA — '+member.full_name+'\\n'+
      (rows.length?rows.join('\\n'):'Sem rifas históricas cadastradas.')+
      '\\nSubtotal estimado destas rifas: '+fmt.format(estimatedTotal/100)+
      '\\nNão inclui juros de empréstimos nem reajustes de centavos do fechamento anual.'+
      '\\nImportante: o total consolidado já creditado de 2026 NÃO é recalculado por esta programação.';
  }
  function invalidateAdjustment(){
    lastAdjustment=null;
    $('#yieldConfirmBtn').disabled=true;
    write('#yieldPreview','Faça a prévia antes de confirmar.');
    $('#yieldRecipientWrap').classList.toggle('hidden',$('#yieldMode').value!=='transfer');
  }
  function invalidateRaffle(){
    lastRaffle=null;
    $('#yieldRaffleConfirm').disabled=true;
    write('#yieldRafflePreview','Confira o resultado antes de distribuir.');
  }
  function paramsAdjustment(){
    const amount=Number($('#yieldAmount').value);
    if(!Number.isFinite(amount)||amount<=0)throw new Error('Informe um valor maior que zero.');
    if(!$('#yieldBatch').value)throw new Error('Não existe lote com rendimentos creditados.');
    const mode=$('#yieldMode').value;
    const recipient=mode==='transfer'?$('#yieldRecipient').value:null;
    if(mode==='transfer'&&(!recipient||recipient===$('#yieldMember').value))
      throw new Error('Escolha outro cotista para receber o valor.');
    return {
      p_batch_id:$('#yieldBatch').value,
      p_member_id:$('#yieldMember').value,
      p_amount:Math.round(amount*100)/100,
      p_mode:mode,
      p_recipient_id:recipient
    };
  }
  function showAdjustmentPreview(plan){
    const lines=(plan.member_deltas||[]).map(l=>{
      const name=names.get(l.member_id)||'Cotista';
      const amount=Number(l.delta);
      return name+': '+(amount>0?'+':'−')+fmt.format(Math.abs(amount));
    });
    write('#yieldPreview',
      'ANTES: '+fmt.format(Number(plan.before))+' • DEPOIS: '+fmt.format(Number(plan.after))+
      '\n'+(plan.mode==='hold'?'Reserva da caixinha: '+fmt.format(Number(plan.reserve))+'\n':'')+
      lines.join('\n'));
  }
  function showRafflePreview(plan){
    write('#yieldRafflePreview',
      plan.event_title+' — '+formattedDate(plan.event_date)+'\n'+
      'Recebido: '+fmt.format(Number(plan.paid))+' • Saídas: '+fmt.format(Number(plan.expenses))+
      ' • Lucro: '+fmt.format(Number(plan.gross_profit))+'\n'+
      'ADM 10%: '+fmt.format(Number(plan.admin_fee))+
      ' • Cota virtual: '+fmt.format(Number(plan.virtual_share_amount))+
      ' • ADM total: '+fmt.format(Number(plan.admin_total))+'\n'+
      'Cotas reais: '+plan.real_share_count+' • Valor por cota: '+fmt.format(Number(plan.per_share))+
      '\n'+(plan.members||[]).map(m=>m.name+' ('+m.shares+' cotas): '+fmt.format(Number(m.amount))).join(' • '));
  }
  async function queryTable(table,cols,filter){
    let q=db.from(table).select(cols);
    if(filter)q=filter(q);
    const {data,error}=await q;
    if(error)throw error;
    return data||[];
  }
  async function refresh(){
    if(loading||!isAdmin())return;
    loading=true;
    try{
      const [m,s,r,ex,d]=await Promise.all([
        queryTable('profiles','id,full_name,cotista_number,share_count',
          q=>q.not('cotista_number','is',null).order('cotista_number')),
        queryTable('member_share_schedule','member_id,effective_from,share_count,reason'),
        queryTable('activities','id,title,type,status,ends_at,target_amount',
          q=>q.eq('type','draw').order('ends_at')),
        queryTable('activity_expenses','activity_id,amount'),
        queryTable('interest_distributions','batch_id',q=>q.eq('status','credited'))
      ]);
      members=m;schedules=s;raffles=r;eventExpenses=ex;
      names.clear();members.forEach(mem=>names.set(mem.id,mem.full_name));
      const chosenBatchIds=[...new Set(d.map(x=>x.batch_id).filter(Boolean))];
      batches=chosenBatchIds.length?await queryTable('interest_distribution_batches',
        'id,transaction_date,gross_amount,source_kind,external_key',
        q=>q.in('id',chosenBatchIds).order('transaction_date',{ascending:false})):[];
      for(const selector of ['#yieldShareMember','#yieldMember','#yieldRecipient']){
        optionList(selector,members,x=>x.id,x=>x.full_name+(x.share_count>1?' ('+x.share_count+' cotas atuais)':''));
      }
      optionList('#yieldBatch',batches,x=>x.id,x=>
        (x.external_key?.startsWith('manual-profit-')?'Fechamento anual '+x.transaction_date.slice(0,4):
        x.source_kind==='raffle'?'Lucro de rifa':'Juros de empréstimo')+
        ' • '+formattedDate(x.transaction_date)+' • '+fmt.format(Number(x.gross_amount)));
      optionList('#yieldRaffle',raffles.filter(x=>x.status==='closed'),x=>x.id,x=>x.title+' ('+formattedDate(x.ends_at)+')');
      if(!$('#yieldEffectiveDate').value)$('#yieldEffectiveDate').value=new Date().toISOString().slice(0,10);
      if(!$('#yieldShareCount').value)$('#yieldShareCount').value=String(getMember($('#yieldShareMember').value)?.share_count||1);
      historicalPreview();
      const operations=await queryTable('yield_adjustment_operations',
        'id,batch_id,target_member_id,recipient_member_id,requested_amount,mode,reserve_amount,reason,created_at',
        q=>q.order('created_at',{ascending:false}).limit(12));
      const el=$('#yieldAdjustmentsHistory');
      el.replaceChildren();
      if(!operations.length){el.textContent='Nenhum ajuste confirmado.'}
      for(const op of operations){
        const p=document.createElement('p');p.className='yield-audit-row';
        const dest=op.mode==='hold'?'reserva sem redistribuição':
          op.mode==='transfer'?'transferido para '+(names.get(op.recipient_member_id)||'cotista'):
          'redistribuído entre os demais cotistas';
        p.textContent=formattedDate(op.created_at.slice(0,10))+' • '+
          (names.get(op.target_member_id)||'Cotista')+' −'+fmt.format(Number(op.requested_amount))+
          ' → '+dest+' • Motivo: '+op.reason;
        el.appendChild(p);
      }
    }catch(err){
      write('#yieldPreview','Erro ao carregar gestão de rendimentos: '+(err.message||err),true);
    }finally{loading=false;}
  }
  async function previewAdjustment(){
    try{
      const args=paramsAdjustment();
      const {data,error}=await db.rpc('admin_preview_yield_adjustment_v2',args);
      if(error)throw error;
      lastAdjustment={args,plan:data};
      showAdjustmentPreview(data);
      $('#yieldConfirmBtn').disabled=false;
    }catch(err){
      invalidateAdjustment();
      write('#yieldPreview',err.message||'Não foi possível gerar a prévia.',true);
    }
  }
  async function confirmAdjustment(e){
    e.preventDefault();
    if(!lastAdjustment)return;
    const reason=$('#yieldReason').value.trim();
    if(reason.length<5){tell('Informe o motivo com pelo menos 5 caracteres.');return}
    const args=paramsAdjustment();
    if(JSON.stringify(args)!==JSON.stringify(lastAdjustment.args)){invalidateAdjustment();return}
    const btn=$('#yieldConfirmBtn');btn.disabled=true;
    try{
      const {data:latest,error:previewError}=await db.rpc('admin_preview_yield_adjustment_v2',args);
      if(previewError)throw previewError;
      if(JSON.stringify(latest.member_deltas)!==JSON.stringify(lastAdjustment.plan.member_deltas)
        ||Number(latest.before)!==Number(lastAdjustment.plan.before))
        throw new Error('Os valores mudaram. Gere uma nova prévia.');
      const ok=confirm('Confirmar abatimento de '+fmt.format(args.p_amount)+'?\n'+
        (args.p_mode==='hold'?'O valor ficará reservado e não será distribuído.':
          args.p_mode==='transfer'?'O valor será creditado somente ao destinatário selecionado.':
            'O valor será dividido entre os outros cotistas do lote.')+
        '\nO histórico original será preservado.');
      if(!ok){btn.disabled=false;return}
      const {error}=await db.rpc('admin_apply_yield_adjustment_v2',{
        ...args,p_reason:reason,p_operation_id:crypto.randomUUID()
      });
      if(error)throw error;
      invalidateAdjustment();
      $('#yieldAdjustmentForm').reset();
      tell('Ajuste confirmado e registrado na auditoria.');
      await refresh();
      await renderAll();
    }catch(err){
      write('#yieldPreview',err.message||'Falha ao confirmar.',true);
      btn.disabled=false;
    }
  }
  async function saveSchedule(e){
    e.preventDefault();
    const memberId=$('#yieldShareMember').value,date=$('#yieldEffectiveDate').value;
    const qty=Number($('#yieldShareCount').value),reason=$('#yieldShareReason').value.trim();
    if(!memberId||!date||qty<1||qty>20||reason.length<5){tell('Preencha cotista, data, cotas e motivo.');return}
    const name=names.get(memberId)||'cotista';
    if(!confirm('Programar '+qty+' cota(s) para '+name+' a partir de '+formattedDate(date)+
       '?\nIsso NÃO recalcula os rendimentos já fechados nem mexe nos pagamentos anteriores.'))return;
    const btn=e.submitter;btn.disabled=true;
    try{
      const {error}=await db.rpc('admin_schedule_member_shares',{
        p_member_id:memberId,p_effective_from:date,p_share_count:qty,p_reason:reason
      });
      if(error)throw error;
      tell('Nova quantidade de cotas registrada por período.');
      $('#yieldShareReason').value='';
      await refresh();
      await renderAll();
    }catch(err){tell(err.message||'Erro ao programar cotas.')}
    finally{btn.disabled=false}
  }
  async function previewRaffle(){
    const id=$('#yieldRaffle').value;
    if(!id){write('#yieldRafflePreview','Nenhuma rifa encerrada para distribuir.',true);return}
    try{
      const {data,error}=await db.rpc('admin_preview_raffle_yield',{p_activity_id:id});
      if(error)throw error;
      lastRaffle={id,plan:data};
      showRafflePreview(data);
      $('#yieldRaffleConfirm').disabled=false;
    }catch(err){invalidateRaffle();write('#yieldRafflePreview',err.message||'Não foi possível simular.',true)}
  }
  async function confirmRaffle(e){
    e.preventDefault();
    if(!lastRaffle)return;
    const reason=$('#yieldRaffleReason').value.trim();
    if(reason.length<5){tell('Informe o motivo da distribuição.');return}
    const id=$('#yieldRaffle').value;
    if(id!==lastRaffle.id){invalidateRaffle();return}
    const btn=$('#yieldRaffleConfirm');btn.disabled=true;
    try{
      const {data:latest,error:previewError}=await db.rpc('admin_preview_raffle_yield',{p_activity_id:id});
      if(previewError)throw previewError;
      if(JSON.stringify(latest)!==JSON.stringify(lastRaffle.plan))
        throw new Error('Os valores mudaram. Refaça a prévia antes de confirmar.');
      if(!confirm('Distribuir '+fmt.format(Number(latest.gross_profit))+
        ' de lucro desta rifa, com '+latest.real_share_count+
        ' cotas reais e '+latest.virtual_share_count+' cota virtual?')){btn.disabled=false;return}
      const {error}=await db.rpc('admin_confirm_raffle_yield',{
        p_activity_id:id,p_expected_profit:Number(latest.gross_profit),p_reason:reason
      });
      if(error)throw error;
      tell('Rendimento da rifa distribuído e auditado.');
      $('#yieldRaffleReason').value='';
      invalidateRaffle();
      await refresh();await renderAll();
    }catch(err){write('#yieldRafflePreview',err.message||'Falha ao distribuir.',true);btn.disabled=false}
  }
  $('#yieldShareForm').addEventListener('submit',saveSchedule);
  $('#yieldAdjustmentForm').addEventListener('submit',confirmAdjustment);
  $('#yieldRaffleForm').addEventListener('submit',confirmRaffle);
  $('#yieldPreviewBtn').addEventListener('click',previewAdjustment);
  $('#yieldRafflePreviewBtn').addEventListener('click',previewRaffle);
  for(const id of ['#yieldMember','#yieldBatch','#yieldAmount','#yieldMode','#yieldRecipient','#yieldReason']){
    $(id).addEventListener('input',invalidateAdjustment);
    $(id).addEventListener('change',invalidateAdjustment);
  }
  for(const id of ['#yieldRaffle','#yieldRaffleReason']){
    $(id).addEventListener('change',invalidateRaffle);
    $(id).addEventListener('input',invalidateRaffle);
  }
  for(const id of ['#yieldShareMember','#yieldEffectiveDate','#yieldShareCount']){
    $(id).addEventListener('change',historicalPreview);
    $(id).addEventListener('input',historicalPreview);
  }
  let wasVisible=false;
  function check(){
    const visible=!!state?.user&&isAdmin()&&!$('#appView').classList.contains('hidden');
    if(visible&&!wasVisible)refresh();
    wasVisible=visible;
  }
  new MutationObserver(check).observe($('#appView'),{attributes:true,attributeFilter:['class']});
  setTimeout(check,200);
})();