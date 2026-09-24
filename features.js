/* OLIVER Caixinha - recursos de sorteio numerado + chatbot */
(() => {
  const $ = s => document.querySelector(s);

  /* ===== Chatbot dos cotistas ===== */
  const fab = $('#chatbotFab');
  const panel = $('#chatbotPanel');
  const messages = $('#chatbotMessages');
  const input = $('#chatbotInput');
  const unread = $('#chatbotUnread');

  function addChat(text, who='bot'){
    if(!messages) return;
    const el=document.createElement('div');
    el.className='chat-msg '+who;
    el.textContent=text;
    messages.appendChild(el);
    messages.scrollTop=messages.scrollHeight;
  }

  async function refreshUnread(){
    if(!state?.user || isAdmin()) return;
    const {count}=await db.from('member_notifications')
      .select('id',{count:'exact',head:true})
      .eq('member_id',state.user.id)
      .is('read_at',null);
    const n=count||0;
    unread.textContent=String(n);
    unread.classList.toggle('hidden',n===0);
  }

  async function showNotifications(){
    if(!state?.user || isAdmin()) return;
    const {data}=await db.from('member_notifications')
      .select('id,title,message,created_at')
      .eq('member_id',state.user.id)
      .is('read_at',null)
      .order('created_at',{ascending:false})
      .limit(8);
    if((data||[]).length){
      addChat('Você tem '+data.length+' aviso(s) novo(s):','bot');
      data.slice().reverse().forEach(n=>addChat(n.title+' — '+n.message,'bot notice'));
      await db.from('member_notifications')
        .update({read_at:new Date().toISOString()})
        .eq('member_id',state.user.id)
        .is('read_at',null);
    }
    await refreshUnread();
  }

  async function askChat(question){
    const text=String(question||'').trim();
    if(!text) return;
    addChat(text,'user');
    input.value='';
    addChat('Consultando seus dados...','bot typing');
    const typing=messages.lastElementChild;
    try{
      const {data:{session}}=await db.auth.getSession();
      const r=await fetch(`${cfg.supabaseUrl}/functions/v1/cotista-chat`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':cfg.supabaseKey,
          'Authorization':`Bearer ${session.access_token}`
        },
        body:JSON.stringify({question:text})
      });
      const j=await r.json().catch(()=>({error:'Resposta inválida.'}));
      typing.remove();
      if(!r.ok) throw new Error(j.error||'Não foi possível responder.');
      addChat(j.answer,'bot');
      if(Array.isArray(j.quick_replies)){
        $('#chatbotQuick').innerHTML=j.quick_replies.map(q=>`<button type="button">${safe(q)}</button>`).join('');
      }
    }catch(err){
      typing?.remove();
      addChat(err.message||'Não foi possível responder agora.','bot error');
    }
  }

  function syncChatVisibility(){
    if(!fab || !panel) return;
    const appVisible=!$('#appView').classList.contains('hidden');
    const visible=appVisible && state?.user && !isAdmin();
    fab.classList.toggle('hidden',!visible);
    if(!visible) panel.classList.add('hidden');
    if(visible) refreshUnread();
  }

  if(fab){
    fab.addEventListener('click',async()=>{
      panel.classList.toggle('hidden');
      if(!panel.classList.contains('hidden')) await showNotifications();
    });
    $('#chatbotClose').addEventListener('click',()=>panel.classList.add('hidden'));
    $('#chatbotForm').addEventListener('submit',e=>{e.preventDefault();askChat(input.value)});
    $('#chatbotQuick').addEventListener('click',e=>{
      const b=e.target.closest('button'); if(b) askChat(b.textContent);
    });
    $('#chatbotEscalate').addEventListener('click',async()=>{
      if(!state?.user) return;
      const details='Cotista solicitou contato da administração pelo Oliver Assistente.';
      const {error}=await db.from('service_requests').insert({
        member_id:state.user.id,
        request_type:'other',
        subject:'Atendimento solicitado pelo chatbot',
        details,
        status:'pending'
      });
      if(error){addChat('Não consegui abrir a solicitação: '+error.message,'bot error');return}
      addChat('Pronto. Sua solicitação foi enviada para a administração.','bot');
    });
    new MutationObserver(syncChatVisibility).observe($('#appView'),{attributes:true,attributeFilter:['class']});
    setTimeout(syncChatVisibility,100);
  }

  /* ===== Sorteios numerados ===== */
  async function fetchAllRaffleNumbers(activityId){
    const all=[]; let from=0; const size=1000;
    while(true){
      const {data,error}=await db.from('raffle_numbers')
        .select('*')
        .eq('activity_id',activityId)
        .order('number')
        .range(from,from+size-1);
      if(error) throw error;
      all.push(...(data||[]));
      if(!data || data.length<size) break;
      from+=size;
    }
    return all;
  }

  window.renderActivities = async function(){
    const {data:acts,error}=await db.from('activities')
      .select('*,raffle_configs(*)')
      .neq('status','draft')
      .order('created_at',{ascending:false});
    if(error){$('#activityCards').innerHTML='<div class="stack-item"><p>Não foi possível carregar as atividades.</p></div>';return}

    let entries=[];
    if(isAdmin()&&(acts||[]).length){
      const {data}=await db.from('activity_entries').select('*').in('activity_id',acts.map(a=>a.id));
      entries=data||[];
    }

    $('#activityCards').innerHTML=(acts||[]).map(a=>{
      const list=entries.filter(e=>e.activity_id===a.id);
      const raised=list.reduce((s,e)=>s+Number(e.amount_paid||0),0);
      const cfg=Array.isArray(a.raffle_configs)?a.raffle_configs[0]:a.raffle_configs;
      const raffleInfo=cfg
        ? `<div class="raffle-summary"><span>Números <b>${cfg.number_start}–${cfg.number_end}</b></span><span>Valor/nº <b>${brl.format(Number(cfg.number_price))}</b></span><span>Taxa ADM <b>${cfg.admin_fee_mode==='percent'?Number(cfg.admin_fee_value).toLocaleString('pt-BR')+'%':brl.format(Number(cfg.admin_fee_value))+'/nº'}</b></span></div><button class="outline-btn raffle-open-btn" onclick="openRaffleNumbers('${a.id}')">Ver tabela de números</button>`
        : '';
      return `<article class="activity-card">
        <div class="activity-cover ${a.type==='draw'?'sorteio':'passeio'}"><span>${a.type==='draw'?'SORTEIO':a.type==='trip'?'PASSEIO':'EVENTO'}</span>${statusBadge(a.status)}</div>
        <div class="activity-body">
          <h4>${safe(a.title)}</h4>
          <p>${safe(a.description||'')}</p>
          <div class="activity-stats">
            <div><span>Valor</span><b>${brl.format(Number(a.unit_price||0))}</b></div>
            <div><span>${isAdmin()?'Arrecadado':'Meta'}</span><b>${brl.format(isAdmin()?raised:Number(a.target_amount||0))}</b></div>
            <div><span>Status</span><b>${safe(a.status)}</b></div>
          </div>
          ${raffleInfo}
        </div>
      </article>`;
    }).join('')||'<div class="stack-item"><p>Nenhuma atividade cadastrada.</p></div>';
  };

  window.openRaffleNumbers = async function(activityId){
    try{
      const [{data:activity,error:aerr},{data:cfg,error:cerr},numbers]=await Promise.all([
        db.from('activities').select('*').eq('id',activityId).single(),
        db.from('raffle_configs').select('*').eq('activity_id',activityId).single(),
        fetchAllRaffleNumbers(activityId)
      ]);
      if(aerr||cerr) throw aerr||cerr;

      let memberMap={};
      if(isAdmin()){
        const ids=[...new Set(numbers.map(n=>n.member_id).filter(Boolean))];
        if(ids.length){
          const {data}=await db.from('profiles').select('id,full_name').in('id',ids);
          memberMap=Object.fromEntries((data||[]).map(p=>[p.id,p.full_name]));
        }
      }

      const available=numbers.filter(n=>n.status==='available').length;
      const reserved=numbers.filter(n=>n.status==='reserved').length;
      const paid=numbers.filter(n=>n.status==='paid').length;
      const gross=numbers.filter(n=>n.status==='paid').reduce((s,n)=>s+Number(n.number_price),0);
      const fee=numbers.filter(n=>n.status==='paid').reduce((s,n)=>s+Number(n.admin_fee_amount),0);
      const mineReserved=numbers.filter(n=>n.member_id===state.user.id&&n.status==='reserved');

      const grid=numbers.map(n=>{
        const mine=n.member_id===state.user.id;
        let cls='available', disabled='';
        if(n.status==='reserved'){cls=mine?'my-reserved':'reserved'; if(!isAdmin()) disabled='disabled'}
        if(n.status==='paid'){cls=mine?'my-paid':'paid'; disabled='disabled'}
        if(n.status==='cancelled'){cls='cancelled';disabled='disabled'}
        if(isAdmin()){
          if(n.status==='reserved'){disabled='';cls='reserved admin-pick'}
          else disabled='disabled';
        }
        const owner=isAdmin()&&n.member_id?memberMap[n.member_id]||'Cotista':'';
        return `<button type="button" class="raffle-number ${cls}" data-number="${n.number}" ${disabled} title="${safe(owner)}"><b>${n.number}</b>${owner?`<small>${safe(owner)}</small>`:''}</button>`;
      }).join('');

      const adminStats=isAdmin()
        ? `<div class="raffle-finance"><div><small>Bruto confirmado</small><b>${brl.format(gross)}</b></div><div><small>Taxa administrativa</small><b>${brl.format(fee)}</b></div><div><small>Líquido da caixinha</small><b>${brl.format(gross-fee)}</b></div></div>`
        : '';

      const action=isAdmin()
        ? '<button id="raffleConfirmPaid" class="primary-btn" type="button">Confirmar pagamento selecionado</button>'
        : `<button id="raffleReserveSelected" class="primary-btn" type="button">Reservar selecionados</button>${mineReserved.length?'<button id="raffleReleaseMine" class="outline-btn" type="button">Liberar meus reservados</button>':''}`;

      openModal(`<div class="raffle-modal">
        <div class="panel-head"><div><h3>${safe(activity.title)}</h3><p>${brl.format(Number(cfg.number_price))} por número • ${available} disponíveis • ${reserved} reservados • ${paid} pagos</p></div></div>
        ${adminStats}
        <div class="raffle-legend"><span class="available">Disponível</span><span class="reserved">Reservado</span><span class="paid">Pago</span></div>
        <div id="raffleNumberGrid" class="raffle-number-grid">${grid}</div>
        <div class="raffle-selection"><span id="raffleSelectedText">Nenhum número selecionado.</span><div class="row-actions">${action}</div></div>
      </div>`);

      const numberGrid=$('#raffleNumberGrid');
      numberGrid.addEventListener('click',e=>{
        const b=e.target.closest('.raffle-number');
        if(!b||b.disabled) return;
        if(isAdmin() && !b.classList.contains('admin-pick')) return;
        b.classList.toggle('selected');
        const selected=[...numberGrid.querySelectorAll('.raffle-number.selected')].map(x=>Number(x.dataset.number));
        $('#raffleSelectedText').textContent=selected.length
          ? 'Selecionados: '+selected.join(', ')
          : 'Nenhum número selecionado.';
      });

      $('#raffleReserveSelected')?.addEventListener('click',async()=>{
        const selected=[...numberGrid.querySelectorAll('.raffle-number.selected')].map(x=>Number(x.dataset.number));
        if(!selected.length){toast('Selecione pelo menos um número.');return}
        const {data,error}=await db.rpc('reserve_raffle_numbers',{p_activity_id:activityId,p_numbers:selected});
        if(error){toast(error.message);return}
        toast('Números reservados. Total: '+brl.format(Number(data?.amount_due||0)));
        closeModal(); await renderActivities(); await refreshUnread();
      });

      $('#raffleReleaseMine')?.addEventListener('click',async()=>{
        const nums=mineReserved.map(n=>n.number);
        if(!nums.length) return;
        if(!confirm('Liberar todos os seus números ainda não pagos?')) return;
        const {error}=await db.rpc('release_my_raffle_numbers',{p_activity_id:activityId,p_numbers:nums});
        if(error){toast(error.message);return}
        toast('Reserva liberada.');closeModal();await renderActivities();
      });

      $('#raffleConfirmPaid')?.addEventListener('click',async()=>{
        const selected=[...numberGrid.querySelectorAll('.raffle-number.selected')].map(x=>Number(x.dataset.number));
        if(!selected.length){toast('Selecione números reservados.');return}
        const {data,error}=await db.rpc('admin_confirm_raffle_numbers',{p_activity_id:activityId,p_numbers:selected});
        if(error){toast(error.message);return}
        toast((data?.confirmed||0)+' número(s) confirmado(s).');
        closeModal();await Promise.all([renderActivities(),renderDashboard(),renderAdmin()]);
      });
    }catch(err){toast(err.message||'Não foi possível abrir o sorteio.')}
  };

  /* Substitui o cadastro genérico de atividade quando for sorteio */
  const newActivityBtn=$('#newActivityBtn');
  if(newActivityBtn){
    newActivityBtn.addEventListener('click',e=>{
      e.preventDefault();e.stopImmediatePropagation();
      if(!isAdmin()){toast('Somente a administração pode criar atividades.');return}
      openModal(`<div class="panel-head"><div><h3>Nova atividade</h3><p>Para sorteios, defina a tabela de números, o valor por número e a taxa administrativa.</p></div></div>
      <form id="activitySmartForm" class="form-grid">
        <label>Tipo<select id="smartActType"><option value="draw">Sorteio</option><option value="trip">Passeio</option><option value="other">Outro</option></select></label>
        <label>Status<input value="Aberto ao publicar" disabled></label>
        <label class="full-span">Título<input id="smartActTitle" required></label>
        <label class="full-span">Descrição<textarea id="smartActDesc" rows="3"></textarea></label>

        <div id="raffleCreateFields" class="raffle-create-fields full-span">
          <label>Número inicial<input id="raffleStart" type="number" min="0" value="1" required></label>
          <label>Número final<input id="raffleEnd" type="number" min="1" value="100" required></label>
          <label>Valor de cada número<input id="rafflePrice" type="number" min="0.01" step="0.01" value="10" required></label>
          <label>Modelo da taxa<select id="raffleFeeMode"><option value="percent">Percentual (%)</option><option value="fixed_per_number">Valor fixo por número (R$)</option></select></label>
          <label>Taxa de administração<input id="raffleFeeValue" type="number" min="0" step="0.01" value="0" required></label>
          <label>Data do sorteio / encerramento<input id="raffleEndDate" type="date"></label>
        </div>

        <div id="genericActivityFields" class="full-span hidden form-grid">
          <label>Valor por pessoa<input id="genericActPrice" type="number" min="0" step="0.01" value="0"></label>
          <label>Meta<input id="genericActGoal" type="number" min="0" step="0.01" value="0"></label>
        </div>
        <button class="primary-btn full-span" type="submit">Publicar atividade</button>
      </form>`);

      const type=$('#smartActType'), raffleFields=$('#raffleCreateFields'), generic=$('#genericActivityFields');
      const sync=()=>{const draw=type.value==='draw';raffleFields.classList.toggle('hidden',!draw);generic.classList.toggle('hidden',draw)};
      type.addEventListener('change',sync);sync();

      $('#activitySmartForm').addEventListener('submit',async ev=>{
        ev.preventDefault();
        const btn=ev.submitter;btn.disabled=true;btn.textContent='Publicando...';
        try{
          if(type.value==='draw'){
            const {error}=await db.rpc('admin_create_raffle',{
              p_title:$('#smartActTitle').value.trim(),
              p_description:$('#smartActDesc').value.trim()||null,
              p_number_start:Number($('#raffleStart').value),
              p_number_end:Number($('#raffleEnd').value),
              p_number_price:Number($('#rafflePrice').value),
              p_admin_fee_mode:$('#raffleFeeMode').value,
              p_admin_fee_value:Number($('#raffleFeeValue').value||0),
              p_starts_at:new Date().toISOString().slice(0,10),
              p_ends_at:$('#raffleEndDate').value||null,
              p_target_amount:0
            });
            if(error) throw error;
          }else{
            const {error}=await db.from('activities').insert({
              type:type.value,
              title:$('#smartActTitle').value.trim(),
              description:$('#smartActDesc').value.trim()||null,
              unit_price:Number($('#genericActPrice').value||0),
              target_amount:Number($('#genericActGoal').value||0),
              status:'open',
              created_by:state.user.id
            });
            if(error) throw error;
          }
          closeModal();await renderActivities();toast('Atividade publicada.');
        }catch(err){toast(err.message||'Não foi possível publicar.')}
        finally{btn.disabled=false;btn.textContent='Publicar atividade'}
      });
    },true);
  }
})();