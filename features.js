/* OLIVER Caixinha - Chatbot + Rifa automática de 100 números */
(() => {
  const $ = s => document.querySelector(s);

  /* ================= CHATBOT ================= */
  const fab=$('#chatbotFab'), panel=$('#chatbotPanel'), messages=$('#chatbotMessages'), input=$('#chatbotInput'), unread=$('#chatbotUnread');

  function addChat(text,who='bot'){
    if(!messages)return;
    const el=document.createElement('div');
    el.className='chat-msg '+who;
    el.textContent=text;
    messages.appendChild(el);
    messages.scrollTop=messages.scrollHeight;
  }

  async function refreshUnread(){
    if(!state?.user||isAdmin())return;
    const {count}=await db.from('member_notifications').select('id',{count:'exact',head:true}).eq('member_id',state.user.id).is('read_at',null);
    const n=count||0;
    unread.textContent=String(n);
    unread.classList.toggle('hidden',n===0);
  }

  async function showNotifications(){
    if(!state?.user||isAdmin())return;
    const {data}=await db.from('member_notifications').select('id,title,message').eq('member_id',state.user.id).is('read_at',null).order('created_at',{ascending:false}).limit(8);
    if((data||[]).length){
      addChat('Você tem '+data.length+' aviso(s) novo(s):');
      data.slice().reverse().forEach(n=>addChat(n.title+' — '+n.message,'bot notice'));
      await db.from('member_notifications').update({read_at:new Date().toISOString()}).eq('member_id',state.user.id).is('read_at',null);
    }
    await refreshUnread();
  }

  async function askChat(question){
    const text=String(question||'').trim();
    if(!text)return;
    addChat(text,'user');
    input.value='';
    addChat('Consultando seus dados...','bot typing');
    const typing=messages.lastElementChild;
    try{
      const {data:{session}}=await db.auth.getSession();
      const r=await fetch(`${cfg.supabaseUrl}/functions/v1/cotista-chat`,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':cfg.supabaseKey,'Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({question:text})
      });
      const j=await r.json().catch(()=>({error:'Resposta inválida.'}));
      typing?.remove();
      if(!r.ok)throw new Error(j.error||'Não foi possível responder.');
      addChat(j.answer);
      if(Array.isArray(j.quick_replies)){
        $('#chatbotQuick').innerHTML=j.quick_replies.map(q=>`<button type="button">${safe(q)}</button>`).join('');
      }
    }catch(err){
      typing?.remove();
      addChat(err.message||'Não foi possível responder agora.','bot error');
    }
  }

  function syncChatVisibility(){
    if(!fab||!panel)return;
    const visible=!$('#appView').classList.contains('hidden')&&state?.user&&!isAdmin();
    fab.classList.toggle('hidden',!visible);
    if(!visible)panel.classList.add('hidden');
    if(visible)refreshUnread();
  }

  if(fab){
    fab.addEventListener('click',async()=>{panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))await showNotifications()});
    $('#chatbotClose').addEventListener('click',()=>panel.classList.add('hidden'));
    $('#chatbotForm').addEventListener('submit',e=>{e.preventDefault();askChat(input.value)});
    $('#chatbotQuick').addEventListener('click',e=>{const b=e.target.closest('button');if(b)askChat(b.textContent)});
    $('#chatbotEscalate').addEventListener('click',async()=>{
      const {error}=await db.from('service_requests').insert({member_id:state.user.id,request_type:'other',subject:'Atendimento solicitado pelo chatbot',details:'Cotista solicitou contato da administração pelo Oliver Assistente.',status:'pending'});
      addChat(error?'Não consegui abrir a solicitação: '+error.message:'Pronto. Sua solicitação foi enviada para a administração.',error?'bot error':'bot');
    });
    new MutationObserver(syncChatVisibility).observe($('#appView'),{attributes:true,attributeFilter:['class']});
    setTimeout(syncChatVisibility,100);
  }

  /* ================= PIX DA CAIXINHA ================= */
  function injectPixSettings(){
    const form=$('#settingsForm');
    if(!form||$('#settingPixReceiverExtra'))return;
    const btn=form.querySelector('button[type="submit"]');
    const wrap=document.createElement('div');
    wrap.className='pix-settings-extra full-span';
    wrap.innerHTML=`
      <div class="pix-settings-grid">
        <label>Tipo da chave Pix
          <select id="settingPixTypeExtra">
            <option value="">Selecione</option><option value="cpf">CPF</option><option value="phone">Telefone</option><option value="email">E-mail</option><option value="random">Aleatória</option>
          </select>
        </label>
        <label>Nome do recebedor
          <input id="settingPixReceiverExtra" maxlength="25" placeholder="Nome que aparece no Pix">
        </label>
        <label>Cidade do recebedor
          <input id="settingPixCityExtra" maxlength="15" placeholder="Ex.: PALMAS">
        </label>
        <div class="pix-config-action">
          <button id="savePixExtraBtn" type="button" class="outline-btn">Salvar dados do Pix</button>
        </div>
      </div>`;
    form.insertBefore(wrap,btn);

    const fill=()=>{
      $('#settingPixTypeExtra').value=state.settings?.pix_key_type||'';
      $('#settingPixReceiverExtra').value=state.settings?.pix_receiver_name||'';
      $('#settingPixCityExtra').value=state.settings?.pix_city||'';
    };
    fill();

    $('#savePixExtraBtn').addEventListener('click',async()=>{
      const key=$('#settingPix').value.trim();
      if(!key){toast('Informe a chave Pix primeiro.');return}
      const patch={
        pix_key:key,
        pix_key_type:$('#settingPixTypeExtra').value||null,
        pix_receiver_name:$('#settingPixReceiverExtra').value.trim().toUpperCase()||null,
        pix_city:$('#settingPixCityExtra').value.trim().toUpperCase()||null,
        updated_by:state.user.id
      };
      const {data,error}=await db.from('fund_settings').update(patch).eq('id',1).select().single();
      if(error){toast(error.message);return}
      state.settings=data;
      toast('Pix da caixinha configurado.');
    });
  }
  setTimeout(injectPixSettings,150);
  new MutationObserver(injectPixSettings).observe(document.body,{childList:true,subtree:true});

  function emv(id,value){return id+String(value.length).padStart(2,'0')+value}
  function cleanPixText(v,max){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 .\-]/g,'').toUpperCase().slice(0,max);
  }
  function crc16(str){
    let crc=0xFFFF;
    for(let c=0;c<str.length;c++){
      crc^=str.charCodeAt(c)<<8;
      for(let i=0;i<8;i++)crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);
      crc&=0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4,'0');
  }
  function buildPixPayload(settings,amount,txid){
    const key=String(settings.pix_key||'').trim();
    if(!key)throw new Error('A chave Pix da caixinha ainda não foi configurada.');
    const name=cleanPixText(settings.pix_receiver_name||settings.fund_name||'OLIVER CAIXINHA',25)||'OLIVER CAIXINHA';
    const city=cleanPixText(settings.pix_city||'PALMAS',15)||'PALMAS';
    const merchant=emv('00','BR.GOV.BCB.PIX')+emv('01',key);
    let payload=emv('00','01')+emv('26',merchant)+emv('52','0000')+emv('53','986');
    payload+=emv('54',Number(amount).toFixed(2))+emv('58','BR')+emv('59',name)+emv('60',city);
    payload+=emv('62',emv('05',cleanPixText(txid||'***',25)||'***'))+'6304';
    return payload+crc16(payload);
  }

  async function openPixPayment(activity,amount){
    const {data:settings,error}=await db.from('fund_settings').select('*').eq('id',1).single();
    if(error)throw error;
    const code=buildPixPayload(settings,amount,'RIFA'+String(activity.id).replaceAll('-','').slice(0,18));
    openModal(`
      <div class="pix-pay-card">
        <span class="eyebrow">PAGAMENTO DA RIFA</span>
        <h3>${safe(activity.title)}</h3>
        <p>Valor total dos seus números</p>
        <div class="pix-pay-value">${brl.format(Number(amount))}</div>
        <div class="pix-pay-key"><small>Chave Pix da caixinha</small><b>${safe(settings.pix_key)}</b></div>
        <label>Pix Copia e Cola<textarea id="pixCopyCode" rows="5" readonly>${safe(code)}</textarea></label>
        <button id="copyRafflePixBtn" class="primary-btn" type="button">Copiar Pix</button>
        <button id="goReceiptBtn" class="outline-btn" type="button">Já paguei • Enviar comprovante</button>
        <p class="pix-pay-note">O valor é preenchido automaticamente. Após o pagamento, envie o comprovante para a administração confirmar.</p>
      </div>`);
    $('#copyRafflePixBtn').addEventListener('click',async()=>{
      await navigator.clipboard.writeText(code);
      toast('Pix copiado.');
    });
    $('#goReceiptBtn').addEventListener('click',()=>{
      closeModal();
      navigate('payments');
      setTimeout(()=>{$('#receiptAmount').value=Number(amount).toFixed(2)},50);
    });
  }

  /* ================= RIFA 100 NÚMEROS ================= */
  async function getActiveQuotaInfo(){
    const {data,error}=await db.from('profiles').select('id,full_name,cotista_number,share_count').eq('active',true).not('cotista_number','is',null).order('cotista_number');
    if(error)throw error;
    const rows=data||[];
    const shares=rows.reduce((s,p)=>s+Number(p.share_count||1),0);
    return {rows,shares};
  }

  async function fetchAllNumbers(activityId){
    const all=[];let from=0;
    while(true){
      const {data,error}=await db.from('raffle_numbers').select('*').eq('activity_id',activityId).order('number').range(from,from+999);
      if(error)throw error;
      all.push(...(data||[]));
      if(!data||data.length<1000)break;
      from+=1000;
    }
    return all;
  }

  window.renderActivities=async function(){
    const {data:acts,error}=await db.from('activities').select('*,raffle_configs(*),raffle_prizes(*)').neq('status','draft').order('created_at',{ascending:false});
    if(error){$('#activityCards').innerHTML='<div class="stack-item"><p>Não foi possível carregar as atividades.</p></div>';return}

    let entries=[];
    if((acts||[]).length){
      const {data}=await db.from('activity_entries').select('*').in('activity_id',acts.map(a=>a.id));
      entries=data||[];
    }

    $('#activityCards').innerHTML=(acts||[]).map(a=>{
      const cfg=Array.isArray(a.raffle_configs)?a.raffle_configs[0]:a.raffle_configs;
      const prizes=(a.raffle_prizes||[]).sort((x,y)=>x.prize_position-y.prize_position);
      const myEntry=entries.find(e=>e.activity_id===a.id&&e.member_id===state.user.id);
      const adminEntries=entries.filter(e=>e.activity_id===a.id);
      const paid=adminEntries.reduce((s,e)=>s+Number(e.amount_paid||0),0);
      const prizesHtml=prizes.length?`<div class="prize-strip">${prizes.map(p=>`<div><span>${p.prize_position}º prêmio</span><b>${safe(p.prize_label)}</b>${p.prize_value!=null?`<small>${brl.format(Number(p.prize_value))}</small>`:''}</div>`).join('')}</div>`:'';

      if(a.type==='draw'&&cfg?.allocation_mode==='quota_equal'){
        return `<article class="activity-card raffle-card-v2">
          <div class="activity-cover sorteio"><span>RIFA • 100 NÚMEROS</span>${statusBadge(a.status)}</div>
          <div class="activity-body">
            <h4>${safe(a.title)}</h4><p>${safe(a.description||'')}</p>
            ${prizesHtml}
            <div class="activity-stats">
              <div><span>Valor por número</span><b>${brl.format(Number(cfg.number_price))}</b></div>
              <div><span>${isAdmin()?'Arrecadado':'Seu total'}</span><b>${brl.format(isAdmin()?paid:Number(myEntry?.amount_due||0))}</b></div>
              <div><span>Distribuição</span><b>Por cota</b></div>
            </div>
            <button class="primary-btn raffle-open-btn" onclick="openQuotaRaffle('${a.id}')">${isAdmin()?'Gerenciar distribuição':'Ver meus números e pagar'}</button>
          </div>
        </article>`;
      }

      return `<article class="activity-card">
        <div class="activity-cover ${a.type==='trip'?'passeio':'sorteio'}"><span>${a.type==='trip'?'PASSEIO':'EVENTO'}</span>${statusBadge(a.status)}</div>
        <div class="activity-body"><h4>${safe(a.title)}</h4><p>${safe(a.description||'')}</p>
        <div class="activity-stats"><div><span>Valor</span><b>${brl.format(Number(a.unit_price||0))}</b></div><div><span>Meta</span><b>${brl.format(Number(a.target_amount||0))}</b></div><div><span>Status</span><b>${safe(a.status)}</b></div></div></div>
      </article>`;
    }).join('')||'<div class="stack-item"><p>Nenhuma atividade cadastrada.</p></div>';
  };

  window.openQuotaRaffle=async function(activityId){
    try{
      const [{data:activity,error:aerr},{data:cfg,error:cerr},{data:prizes,error:perr},numbers]=await Promise.all([
        db.from('activities').select('*').eq('id',activityId).single(),
        db.from('raffle_configs').select('*').eq('activity_id',activityId).single(),
        db.from('raffle_prizes').select('*').eq('activity_id',activityId).order('prize_position'),
        fetchAllNumbers(activityId)
      ]);
      if(aerr||cerr||perr)throw aerr||cerr||perr;

      const ids=[...new Set(numbers.map(n=>n.member_id).filter(Boolean))];
      let members=[];
      if(ids.length){
        const {data,error}=await db.from('profiles').select('id,full_name,cotista_number,share_count').in('id',ids).order('cotista_number');
        if(error)throw error;
        members=data||[];
      }
      const grouped=members.map(m=>{
        const own=numbers.filter(n=>n.member_id===m.id).sort((a,b)=>a.number-b.number);
        return {
          ...m,
          numbers:own,
          amount:own.reduce((s,n)=>s+Number(n.number_price),0),
          paid:own.length>0&&own.every(n=>n.status==='paid')
        };
      });
      const prizesHtml=`<div class="prize-board">${(prizes||[]).map(p=>`<div class="prize-place p${p.prize_position}"><span>${p.prize_position}º</span><b>${safe(p.prize_label)}</b>${p.prize_value!=null?`<small>${brl.format(Number(p.prize_value))}</small>`:''}</div>`).join('')}</div>`;

      if(isAdmin()){
        const gross=numbers.filter(n=>n.status==='paid').reduce((s,n)=>s+Number(n.number_price),0);
        const fee=numbers.filter(n=>n.status==='paid').reduce((s,n)=>s+Number(n.admin_fee_amount),0);
        openModal(`<div class="quota-raffle-modal">
          <div class="panel-head"><div><span class="eyebrow">100 NÚMEROS • DISTRIBUIÇÃO AUTOMÁTICA</span><h3>${safe(activity.title)}</h3><p>Cada cota recebe a mesma quantidade possível de números. O sistema já fez a divisão automaticamente.</p></div></div>
          ${prizesHtml}
          <div class="raffle-finance"><div><small>Arrecadado</small><b>${brl.format(gross)}</b></div><div><small>Taxa administrativa</small><b>${brl.format(fee)}</b></div><div><small>Líquido da rifa</small><b>${brl.format(gross-fee)}</b></div></div>
          <div class="quota-distribution-table"><table class="data-table"><thead><tr><th>Cotista</th><th>Cotas</th><th>Números recebidos</th><th>Total</th><th>Status</th><th>Ação</th></tr></thead><tbody>
          ${grouped.map(g=>`<tr><td><b>${safe(g.full_name)}</b></td><td>${g.share_count}</td><td><div class="number-chips">${g.numbers.map(n=>`<span class="${n.status}">${String(n.number).padStart(2,'0')}</span>`).join('')}</div></td><td>${brl.format(g.amount)}</td><td>${g.paid?statusBadge('confirmed'):statusBadge('pending')}</td><td>${g.paid?'—':`<button class="primary-btn tiny" onclick="confirmQuotaRaffleMember('${activityId}','${g.id}')">Confirmar pagamento</button>`}</td></tr>`).join('')}
          </tbody></table></div>
        </div>`);
      }else{
        const mine=grouped.find(g=>g.id===state.user.id);
        if(!mine){toast('Nenhum número foi atribuído ao seu cadastro.');return}
        openModal(`<div class="quota-raffle-modal member">
          <div class="panel-head"><div><span class="eyebrow">SUA RIFA</span><h3>${safe(activity.title)}</h3><p>Seus números já foram distribuídos conforme a quantidade de cotas.</p></div></div>
          ${prizesHtml}
          <div class="my-raffle-box">
            <small>Seus números</small>
            <div class="my-number-grid">${mine.numbers.map(n=>`<span class="${n.status}">${String(n.number).padStart(2,'0')}</span>`).join('')}</div>
            <div class="my-raffle-total"><span>${mine.numbers.length} número(s) × ${brl.format(Number(cfg.number_price))}</span><b>${brl.format(mine.amount)}</b></div>
          </div>
          ${mine.paid?'<div class="paid-banner">Pagamento confirmado ✅</div>':`<button id="payRafflePixBtn" class="primary-btn full-span" type="button">Pagar ${brl.format(mine.amount)} via Pix</button>`}
        </div>`);
        $('#payRafflePixBtn')?.addEventListener('click',()=>openPixPayment(activity,mine.amount));
      }
    }catch(err){toast(err.message||'Não foi possível abrir a rifa.')}
  };

  window.confirmQuotaRaffleMember=async function(activityId,memberId){
    if(!confirm('Confirmar o pagamento de todos os números deste cotista?'))return;
    const {data,error}=await db.rpc('admin_confirm_raffle_member',{p_activity_id:activityId,p_member_id:memberId});
    if(error){toast(error.message);return}
    toast((data?.confirmed_numbers||0)+' número(s) confirmados.');
    closeModal();
    await Promise.all([renderActivities(),renderDashboard(),renderAdmin()]);
  };

  /* ===== Nova rifa: 100 números + premiação 1/2/3 ===== */
  const newActivityBtn=$('#newActivityBtn');
  if(newActivityBtn){
    newActivityBtn.addEventListener('click',async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      if(!isAdmin()){toast('Somente a administração pode criar atividades.');return}

      let quota;
      try{quota=await getActiveQuotaInfo()}catch(err){toast(err.message);return}
      const perShare=Math.floor(100/Math.max(1,quota.shares));
      const remainder=100%Math.max(1,quota.shares);

      openModal(`<div class="raffle-create-v2">
        <div class="panel-head"><div><span class="eyebrow">NOVA RIFA</span><h3>Rifa automática • 100 números</h3><p>Os 100 números serão distribuídos automaticamente entre todas as cotas ativas.</p></div></div>

        <div class="distribution-preview">
          <div><small>Cotistas ativos</small><b>${quota.rows.length}</b></div>
          <div><small>Cotas ativas</small><b>${quota.shares}</b></div>
          <div><small>Base por cota</small><b>${perShare} nº</b></div>
          <div><small>Restante</small><b>${remainder} nº</b></div>
        </div>

        <form id="quotaRaffleForm" class="form-grid">
          <label class="full-span">Nome da rifa<input id="qrTitle" required placeholder="Ex.: Rifa de Outubro"></label>
          <label class="full-span">Descrição<textarea id="qrDescription" rows="2" placeholder="Informações do sorteio"></textarea></label>
          <label>Valor de cada número<input id="qrPrice" type="number" min="0.01" step="0.01" value="20" required></label>
          <label>Data do sorteio<input id="qrEndDate" type="date"></label>

          <div class="raffle-admin-fee full-span">
            <h4>Taxa de administração</h4>
            <div class="form-grid two">
              <label>Modelo<select id="qrFeeMode"><option value="percent">Percentual da arrecadação</option><option value="fixed_per_number">Valor fixo por número</option></select></label>
              <label>Taxa<input id="qrFeeValue" type="number" min="0" step="0.01" value="0" required></label>
            </div>
          </div>

          <div class="prize-config full-span">
            <h4>Premiação</h4>
            <div class="prize-config-row first"><span>1º</span><input id="qrP1Label" placeholder="Ex.: R$ 500,00 / TV / prêmio" required><input id="qrP1Value" type="number" min="0" step="0.01" placeholder="Valor opcional"></div>
            <div class="prize-config-row second"><span>2º</span><input id="qrP2Label" placeholder="2º prêmio"><input id="qrP2Value" type="number" min="0" step="0.01" placeholder="Valor opcional"></div>
            <div class="prize-config-row third"><span>3º</span><input id="qrP3Label" placeholder="3º prêmio"><input id="qrP3Value" type="number" min="0" step="0.01" placeholder="Valor opcional"></div>
          </div>

          <div class="raffle-total-preview full-span">
            <span>Arrecadação máxima com 100 números</span>
            <b id="qrGrossPreview">${brl.format(2000)}</b>
          </div>

          <button class="primary-btn full-span" type="submit">Criar rifa e distribuir 100 números</button>
        </form>
      </div>`);

      const updateGross=()=>$('#qrGrossPreview').textContent=brl.format(Number($('#qrPrice').value||0)*100);
      $('#qrPrice').addEventListener('input',updateGross);updateGross();

      $('#quotaRaffleForm').addEventListener('submit',async ev=>{
        ev.preventDefault();
        const btn=ev.submitter;btn.disabled=true;btn.textContent='Distribuindo números...';
        try{
          const val=id=>{const v=$(id).value;return v===''?null:Number(v)};
          const {error}=await db.rpc('admin_create_quota_raffle',{
            p_title:$('#qrTitle').value.trim(),
            p_description:$('#qrDescription').value.trim()||null,
            p_number_price:Number($('#qrPrice').value),
            p_admin_fee_mode:$('#qrFeeMode').value,
            p_admin_fee_value:Number($('#qrFeeValue').value||0),
            p_prize1_label:$('#qrP1Label').value.trim(),
            p_prize1_value:val('#qrP1Value'),
            p_prize2_label:$('#qrP2Label').value.trim()||null,
            p_prize2_value:val('#qrP2Value'),
            p_prize3_label:$('#qrP3Label').value.trim()||null,
            p_prize3_value:val('#qrP3Value'),
            p_ends_at:$('#qrEndDate').value||null
          });
          if(error)throw error;
          closeModal();await renderActivities();toast('Rifa criada e números distribuídos automaticamente.');
        }catch(err){toast(err.message||'Não foi possível criar a rifa.')}
        finally{btn.disabled=false;btn.textContent='Criar rifa e distribuir 100 números'}
      });
    },true);
  }
})();