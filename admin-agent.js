(() => {
  const $=s=>document.querySelector(s);
  const fab=$('#adminAgentFab');
  const panel=$('#adminAgentPanel');
  const messages=$('#adminAgentMessages');
  const form=$('#adminAgentForm');
  const input=$('#adminAgentInput');
  if(!fab||!panel||!messages||!form||!input)return;

  function add(text,who='bot',actions=null){
    const wrap=document.createElement('div');
    wrap.className='admin-agent-msg '+who;
    const p=document.createElement('div');
    p.textContent=text;
    wrap.appendChild(p);
    if(actions?.action_id){
      const row=document.createElement('div');
      row.className='admin-agent-confirm';
      const yes=document.createElement('button');
      yes.type='button';yes.className='primary-btn small';yes.textContent='Confirmar';
      yes.addEventListener('click',()=>confirmAction(actions.action_id,wrap));
      const no=document.createElement('button');
      no.type='button';no.className='outline-btn small';no.textContent='Cancelar';
      no.addEventListener('click',()=>cancelAction(actions.action_id,wrap));
      row.append(yes,no);wrap.appendChild(row);
    }
    messages.appendChild(wrap);
    messages.scrollTop=messages.scrollHeight;
    return wrap;
  }

  async function requestAgent(payload){
    const {data:{session}}=await db.auth.getSession();
    if(!session)throw new Error('Sessão expirada.');
    const r=await fetch(`${cfg.supabaseUrl}/functions/v1/admin-finance-chat`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':cfg.supabaseKey,
        'Authorization':`Bearer ${session.access_token}`
      },
      body:JSON.stringify(payload)
    });
    const j=await r.json().catch(()=>({error:'Resposta inválida do Oliver ADM.'}));
    if(!r.ok)throw new Error(j.error||'Não foi possível processar.');
    return j;
  }

  async function send(text){
    const value=String(text||'').trim();
    if(!value)return;
    add(value,'user');
    input.value='';
    const typing=add('Analisando...','bot typing');
    try{
      const j=await requestAgent({message:value});
      typing.remove();
      add(j.answer||'Pronto.','bot',j.requires_confirmation?{action_id:j.action_id}:null);
    }catch(err){
      typing.remove();
      add(err.message||'Não foi possível processar agora.','bot error');
    }
  }

  async function confirmAction(id,wrap){
    const buttons=wrap.querySelectorAll('button');
    buttons.forEach(b=>b.disabled=true);
    try{
      const j=await requestAgent({action:'confirm',action_id:id});
      wrap.querySelector('.admin-agent-confirm')?.remove();
      add(j.answer||'Atualização confirmada.','bot success');
      await renderAll();
    }catch(err){
      buttons.forEach(b=>b.disabled=false);
      add(err.message||'Não foi possível confirmar.','bot error');
    }
  }

  async function cancelAction(id,wrap){
    const buttons=wrap.querySelectorAll('button');
    buttons.forEach(b=>b.disabled=true);
    try{
      const j=await requestAgent({action:'cancel',action_id:id});
      wrap.querySelector('.admin-agent-confirm')?.remove();
      add(j.answer||'Ação cancelada.','bot');
    }catch(err){
      buttons.forEach(b=>b.disabled=false);
      add(err.message||'Não foi possível cancelar.','bot error');
    }
  }

  function sync(){
    const visible=!$('#appView')?.classList.contains('hidden')&&state?.user&&isAdmin();
    fab.classList.toggle('hidden',!visible);
    if(!visible)panel.classList.add('hidden');
  }

  fab.addEventListener('click',()=>panel.classList.toggle('hidden'));
  $('#adminAgentClose')?.addEventListener('click',()=>panel.classList.add('hidden'));
  form.addEventListener('submit',e=>{e.preventDefault();send(input.value)});
  document.querySelectorAll('.admin-agent-quick [data-template]').forEach(btn=>btn.addEventListener('click',()=>{
    input.value=btn.dataset.template||'';
    input.focus();
  }));
  new MutationObserver(sync).observe($('#appView'),{attributes:true,attributeFilter:['class']});
  setTimeout(sync,120);
})();