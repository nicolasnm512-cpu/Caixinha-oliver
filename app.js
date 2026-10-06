const { createClient } = window.supabase;
const cfg = window.OLIVER_CONFIG;
const db = createClient(cfg.supabaseUrl, cfg.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const brl = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const now = new Date();
const currentMonthLabel = now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
const currentMonthRef = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
const state = { session:null, user:null, profile:null, role:'member', settings:null, terms:null, credit:null };

function qs(s){return document.querySelector(s)}
function qsa(s){return [...document.querySelectorAll(s)]}
function toast(msg){const t=qs('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800)}
function formatDate(v){if(!v)return '—';const d=new Date(v.length===10?`${v}T12:00:00`:v);return d.toLocaleDateString('pt-BR')}
function isAdmin(){return state.role==='admin'}
function safe(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function statusBadge(status){const map={confirmed:['success','Confirmado'],pending:['warning','Pendente'],under_review:['warning','Em análise'],approved:['success','Aprovado'],rejected:['danger','Recusado'],cancelled:['neutral','Cancelado'],open:['success','Aberto'],closed:['neutral','Encerrado'],draft:['neutral','Rascunho'],active:['info','Ativo'],paid:['success','Quitado'],late:['danger','Em atraso'],renegotiated:['warning','Renegociado'],recorded:['neutral','Registrado'],unpaid:['danger','Não pago'],review:['warning','Revisão'],void:['neutral','Ignorado']};const [c,l]=map[status]||['neutral',status||'—'];return `<span class="badge ${c}">${l}</span>`}
function showLogin(){qs('#termsView').classList.add('hidden');qs('#firstAccessView').classList.add('hidden');qs('#appView').classList.add('hidden');qs('#loginView').classList.remove('hidden')}
function showTerms(){qs('#loginView').classList.add('hidden');qs('#firstAccessView').classList.add('hidden');qs('#appView').classList.add('hidden');qs('#termsView').classList.remove('hidden');qs('#acceptTermsCheck').checked=false;qs('#acceptTermsBtn').disabled=true;qs('#acceptTermsBtn').classList.add('disabled-btn')}
function showFirstAccess(){
  qs('#loginView').classList.add('hidden');qs('#termsView').classList.add('hidden');qs('#appView').classList.add('hidden');qs('#firstAccessView').classList.remove('hidden');
  qs('#firstAccessName').value=state.profile?.full_name||'';qs('#firstAccessEmail').value=state.profile?.email||state.user?.email||'';qs('#firstAccessPhone').value=state.profile?.phone||'';qs('#firstAccessPassword').value='';qs('#firstAccessPasswordConfirm').value='';
}
function applyRoleExperience(){
  const brandContext=qs('.sidebar-brand span');
  if(brandContext)brandContext.textContent=isAdmin()?'Administração':'Área dos cotistas';
  qsa('.nav-item[data-admin-label]').forEach(btn=>{
    const label=btn.querySelector('.nav-label');
    if(label)label.textContent=isAdmin()?btn.dataset.adminLabel:btn.dataset.memberLabel;
  });
  const loanTitle=qs('#loanSectionTitle');
  const loanSubtitle=qs('#loanSectionSubtitle');
  if(loanTitle)loanTitle.textContent=isAdmin()?'Contratos de empréstimo':'Meus empréstimos';
  if(loanSubtitle)loanSubtitle.textContent=isAdmin()?'Acompanhe todos os contratos por situação.':'Seus contratos separados por situação.';
}

function showApp(){qs('#termsView').classList.add('hidden');qs('#firstAccessView').classList.add('hidden');qs('#loginView').classList.add('hidden');qs('#appView').classList.remove('hidden');qs('#appView').classList.toggle('is-admin',isAdmin());qs('#sidebarName').textContent=state.profile?.full_name||state.user?.email||'Usuário';qs('#sidebarRole').textContent=isAdmin()?'Administrador':'Cotista';qs('#sidebarAvatar').textContent=isAdmin()?'AD':`C${state.profile?.cotista_number||'–'}`;applyRoleExperience();navigate('dashboard');renderAll()}

async function loadCore(){
  const {data:{session}}=await db.auth.getSession();
  if(!session){showLogin();return}
  state.session=session;state.user=session.user;state.role=session.user.app_metadata?.role==='admin'?'admin':'member';
  const {data:profile,error:pe}=await db.from('profiles').select('*').eq('id',session.user.id).single();
  if(pe||!profile){toast('Perfil não encontrado.');await db.auth.signOut();showLogin();return}
  state.profile=profile;
  if(!profile.active){toast('Seu acesso está desativado.');await db.auth.signOut();showLogin();return}
  const [{data:settings},{data:terms}] = await Promise.all([
    db.from('fund_settings').select('*').eq('id',1).single(),
    db.from('terms_versions').select('*').eq('active',true).single()
  ]);
  state.settings=settings;state.terms=terms;
  if(terms){
    const {data:accept}=await db.from('terms_acceptances').select('id').eq('user_id',session.user.id).eq('terms_version',terms.version).maybeSingle();
    if(!accept){
      const eyebrow=qs('#termsView .eyebrow');if(eyebrow)eyebrow.textContent=`PRIMEIRO ACESSO • REGULAMENTO V${terms.version}`;
      qs('#termsTitle').textContent=terms.title||'Termos de participação da OLIVER Caixinha';
      showTerms();return;
    }
  }
  showApp();
}

qs('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const email=qs('#loginEmail').value.trim().toLowerCase(), password=qs('#loginPassword').value;
  const btn=e.submitter; if(btn){btn.disabled=true;btn.textContent='Entrando...'}
  const {error}=await db.auth.signInWithPassword({email,password});
  if(btn){btn.disabled=false;btn.textContent='Entrar no sistema'}
  if(error){toast('E-mail ou senha incorretos.');return}
  await loadCore();
});
qs('#togglePassword').addEventListener('click',()=>{const p=qs('#loginPassword');p.type=p.type==='password'?'text':'password';qs('#togglePassword').textContent=p.type==='password'?'Mostrar':'Ocultar'});
qs('#firstAccessForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const fullName=qs('#firstAccessName').value.trim(),phone=qs('#firstAccessPhone').value.trim(),password=qs('#firstAccessPassword').value,confirmPassword=qs('#firstAccessPasswordConfirm').value;
  if(fullName.length<2){toast('Informe seu nome.');return}
  if(password.length<8){toast('A nova senha deve ter ao menos 8 caracteres.');return}
  if(password!==confirmPassword){toast('As senhas não conferem.');return}
  const btn=e.submitter;if(btn){btn.disabled=true;btn.textContent='Atualizando...'}
  const {error:passError}=await db.auth.updateUser({password});
  if(passError){if(btn){btn.disabled=false;btn.textContent='Salvar e continuar'}toast(passError.message);return}
  const {data:updated,error:profileError}=await db.rpc('complete_first_access',{p_full_name:fullName,p_phone:phone||null});
  if(btn){btn.disabled=false;btn.textContent='Salvar e continuar'}
  if(profileError){toast(profileError.message);return}
  state.profile=Array.isArray(updated)?updated[0]:updated;
  toast('Cadastro atualizado.');
  await loadCore();
});
qs('#firstAccessLogoutBtn').addEventListener('click',async()=>{await db.auth.signOut();showLogin()});
qs('#acceptTermsCheck').addEventListener('change',()=>{const ok=qs('#acceptTermsCheck').checked;qs('#acceptTermsBtn').disabled=!ok;qs('#acceptTermsBtn').classList.toggle('disabled-btn',!ok)});
qs('#acceptTermsBtn').addEventListener('click',async()=>{
  if(!qs('#acceptTermsCheck').checked||!state.user||!state.terms)return;
  const {error}=await db.from('terms_acceptances').insert({user_id:state.user.id,terms_version:state.terms.version,acceptance_method:'checkbox'});
  if(error){toast(error.message);return}showApp();toast('Regulamento aceito. Bem-vindo à OLIVER Caixinha.');
});
qs('#termsLogoutBtn').addEventListener('click',async()=>{await db.auth.signOut();showLogin()});
qs('#logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();showLogin()});
qsa('.nav-item').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
qsa('[data-page-jump]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.pageJump)));

const pageMeta={
  dashboard:['Início','Seu resumo financeiro e os próximos passos.'],
  requests:['Solicitar empréstimo','Simule, envie e acompanhe sua solicitação.'],
  loans:['Empréstimos','Contratos, parcelas, juros e saldo devedor.'],
  payments:['Pagamentos','Pix, comprovantes e confirmações.'],
  activities:['Rifas e passeios','Arrecadação, números, prêmios e poltronas.'],
  account:['Meu cadastro','Dados pessoais, segurança e documentos.'],
  members:['Cotistas','Cadastro, situação financeira, limite e acesso.'],
  admin:['Administração','Pendências, regras, lançamentos e auditoria.']
};
function enhanceResponsiveTables(root=document){
  const tables=[];
  if(root?.matches?.('table.data-table'))tables.push(root);
  if(root?.querySelectorAll)tables.push(...root.querySelectorAll('table.data-table'));
  tables.forEach(table=>{
    if(table.dataset.mobileReady==='1')return;
    const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    if(!headers.length)return;
    table.dataset.mobileReady='1';
    table.classList.add('responsive-card-table');
    table.querySelectorAll('tbody tr').forEach(tr=>{
      [...tr.children].forEach((td,i)=>{
        if(td.tagName==='TD')td.dataset.label=headers[i]||'';
      });
    });
  });
}

function applyCollapsiblePanels(){
  qsa('.page article.panel').forEach(panel=>{
    if(panel.dataset.collapsibleReady==='1'||panel.closest('#admin'))return;
    const head=panel.querySelector(':scope > .panel-head');
    if(!head)return;
    panel.dataset.collapsibleReady='1';
    panel.classList.add('ui-collapsible');
    head.setAttribute('role','button');
    head.setAttribute('tabindex','0');
    head.setAttribute('aria-expanded','true');
    const toggle=()=>{
      const collapsed=panel.classList.toggle('is-collapsed');
      head.setAttribute('aria-expanded',String(!collapsed));
    };
    head.addEventListener('click',e=>{
      if(e.target.closest('button,a,input,select,textarea,label'))return;
      toggle();
    });
    head.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}
    });
    panel.querySelectorAll('form').forEach(form=>form.addEventListener('reset',()=>{
      head.setAttribute('aria-expanded',String(!panel.classList.contains('is-collapsed')));
    }));
  });
}
function navigate(page){
  if((page==='members'||page==='admin')&&!isAdmin()){toast('Área exclusiva da administração.');return}
  if(page==='requests'&&isAdmin()){toast('Solicitações de cotistas ficam em Administração.');page='admin'}
  qsa('.page').forEach(p=>p.classList.remove('active-page'));
  qs(`#${page}`)?.classList.add('active-page');
  qsa('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));
  let title=pageMeta[page]?.[0]||'OLIVER Caixinha';
  let subtitle=pageMeta[page]?.[1]||'';
  if(isAdmin()&&page==='loans'){title='Contratos';subtitle='Empréstimos ativos, atrasados e quitados.'}
  if(isAdmin()&&page==='payments'){title='Comprovantes';subtitle='Confira e confirme os pagamentos enviados pelos cotistas.'}
  qs('#pageTitle').textContent=title;
  qs('#pageSubtitle').textContent=subtitle;
  applyCollapsiblePanels();
  window.scrollTo({top:0,behavior:'smooth'});
}

async function renderDashboard(){
  const hour=new Date().getHours();
  const greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
  const fullName=String(state.profile?.full_name||'Cotista').trim();
  const firstName=fullName.split(/\s+/)[0]||'Cotista';
  qs('#homeGreeting').textContent=greeting;
  qs('#homeName').textContent=firstName;
  qs('#homeRole').textContent=isAdmin()?'Administração da OLIVER Caixinha':`Cotista ${state.profile?.cotista_number?String(state.profile.cotista_number).padStart(2,'0'):''} • resumo de ${now.getFullYear()}`;

  if(isAdmin()){
    const yearStart=`${now.getFullYear()}-01-01`;
    const yearEnd=`${now.getFullYear()}-12-31`;
    const [{data:summary},{data:yearTx},{data:loans},{count:pendingReq},{count:pendingReceipts},{count:members},{data:interestBatches}] = await Promise.all([
      db.from('shared_fund_summary').select('*').maybeSingle(),
      db.from('fund_transactions').select('direction,category,amount,transaction_date').gte('transaction_date',yearStart).lte('transaction_date',yearEnd),
      db.from('loans').select('id,outstanding_amount,status').in('status',['active','late']),
      db.from('loan_requests').select('id',{count:'exact',head:true}).in('status',['pending','under_review']),
      db.from('payment_receipts').select('id',{count:'exact',head:true}).eq('status','pending'),
      db.from('profiles').select('id',{count:'exact',head:true}).eq('active',true).not('cotista_number','is',null),
      db.from('interest_distribution_batches').select('*').gte('transaction_date',yearStart).lte('transaction_date',yearEnd)
    ]);
    const paid=(yearTx||[]).filter(t=>t.direction==='income'&&['contribution','draw','trip'].includes(t.category));
    const paidTotal=paid.reduce((s,t)=>s+Number(t.amount||0),0);
    const contrib=paid.filter(t=>t.category==='contribution').reduce((s,t)=>s+Number(t.amount||0),0);
    const raffles=paid.filter(t=>t.category==='draw').reduce((s,t)=>s+Number(t.amount||0),0);
    const trips=paid.filter(t=>t.category==='trip').reduce((s,t)=>s+Number(t.amount||0),0);
    const debt=(loans||[]).reduce((s,l)=>s+Number(l.outstanding_amount||0),0);

    qs('#homePaidTotal').textContent=brl.format(paidTotal);
    qs('#homePaidBreakdown').textContent=`Cotas ${brl.format(contrib)} • Rifas ${brl.format(raffles)} • Passeios ${brl.format(trips)}`;
    qs('#homeLoanNegative').textContent=debt>0?brl.format(-debt):brl.format(0);
    qs('#homeLoanNote').textContent=debt>0?`${(loans||[]).length} contrato(s) em aberto`:'Sem empréstimos em aberto';
    qs('#homeCashAvailable').textContent=brl.format(Number(summary?.cash_balance||0));
    qs('#homeCashNote').textContent='Disponível para movimentação';
    qs('#homePendingRequests').textContent=String(pendingReq||0);
    qs('#homePendingReceipts').textContent=String(pendingReceipts||0);
    qs('#homeActiveMembers').textContent=String(members||0);
    const adminInterest=(interestBatches||[]).reduce((s,b)=>s+Number(b.admin_total_amount||0),0);
    if(qs('#homeAdminInterest'))qs('#homeAdminInterest').textContent=brl.format(adminInterest);
    if(qs('#homeAdminInterestNote')){
      const fee=Number(state.settings?.interest_admin_fee_percent??10);
      const virtual=Number(state.settings?.admin_virtual_interest_shares??1);
      qs('#homeAdminInterestNote').textContent=`${fee.toLocaleString('pt-BR')}% de taxa + ${virtual} cota(s) virtual(is) de juros`;
    }

    const expenses=(yearTx||[]).filter(t=>t.direction==='expense').reduce((s,t)=>s+Number(t.amount||0),0);
    const cash=Math.max(0,Number(summary?.cash_balance||0));
    const chartValues=[paidTotal,expenses,debt,cash];
    const chartMax=Math.max(1,...chartValues);
    const setBar=(labelId,barId,value)=>{
      const label=qs(labelId),bar=qs(barId);
      if(label)label.textContent=brl.format(value);
      if(bar)bar.style.width=`${Math.max(value>0?4:0,Math.round(value/chartMax*100))}%`;
    };
    setBar('#chartIncomeLabel','#chartIncomeBar',paidTotal);
    setBar('#chartExpenseLabel','#chartExpenseBar',expenses);
    setBar('#chartLoanLabel','#chartLoanBar',debt);
    setBar('#chartCashLabel','#chartCashBar',cash);
    return;
  }

  const {data:memberDashboard,error:memberDashboardError}=await db.rpc('get_my_member_dashboard',{p_year:now.getFullYear()});
  const memberData=Array.isArray(memberDashboard)?memberDashboard[0]:memberDashboard;
  if(memberDashboardError){
    toast('Não foi possível carregar seu resumo financeiro.');
  }else if(memberData){
    qs('#memberPaidContributions').textContent=brl.format(Number(memberData.paid_contributions||0));
    qs('#memberInterestYield').textContent=brl.format(Number(memberData.interest_yield||0));
  }

}

async function renderRequests(){
  const {data:credit}=await db.from('member_credit_summary').select('*').eq('member_id',state.user.id).maybeSingle();state.credit=credit;
  const box=qs('#creditAnalysisBox');
  if(credit){
    box.innerHTML=`<div class="personal-summary">
      <div><span>Contribuições elegíveis</span><b>${brl.format(Number(credit.eligible_contributions))}</b><small>${credit.share_count} cota(s)</small></div>
      <div><span>Limite calculado</span><b>${brl.format(Number(credit.credit_limit))}</b><small>+${state.settings?.credit_bonus_percent??25}%</small></div>
      <div><span>Disponível</span><b>${brl.format(Number(credit.available_credit))}</b><small>${credit.has_overdue_contributions||credit.has_overdue_activities||credit.has_overdue_loans?'Existem pendências':'Sem pendências registradas'}</small></div>
    </div>`;
  }else{
    box.innerHTML='<div class="stack-item"><p>O limite será calculado após os primeiros pagamentos confirmados.</p></div>';
  }

  const q=db.from('loan_requests').select('*').order('requested_at',{ascending:false});
  if(!isAdmin())q.eq('member_id',state.user.id);
  const {data:rows}=await q;
  qs('#requestList').innerHTML=(rows||[]).map(r=>{
    const rate=r.beneficiary_type==='third_party'
      ? Number(state.settings?.third_party_interest_rate??30)
      : Number(state.settings?.operation_interest_rate??25);
    const canAccept=!isAdmin()&&r.status==='rejected'&&Number(r.available_credit_snapshot)>0&&Number(r.requested_amount)>Number(r.available_credit_snapshot);
    return `<div class="stack-item request-card">
      <div>
        <h4>${brl.format(Number(r.requested_amount))} • ${r.requested_installments}x</h4>
        <p>${safe(r.purpose)}${r.beneficiary_type==='third_party'?` • Terceiro: ${safe(r.third_party_name)} • juros ${rate.toLocaleString('pt-BR')}%`:''}<br>${formatDate(r.requested_at)}</p>
        ${r.admin_decision_note?`<small class="decision-note">Motivo/observação: ${safe(r.admin_decision_note)}</small>`:''}
        ${canAccept?`<div class="limit-offer"><span>Valor disponível: <b>${brl.format(Number(r.available_credit_snapshot))}</b></span><button class="primary-btn tiny" onclick="acceptAvailableCredit('${r.id}')">Aceitar este valor</button></div>`:''}
      </div>
      ${statusBadge(r.status)}
    </div>`;
  }).join('')||'<div class="stack-item"><p>Nenhuma solicitação registrada.</p></div>';
}

qs('#requestAmount').addEventListener('input',updateSimulation);
qs('#requestInstallments').addEventListener('change',updateSimulation);
qs('#requestBeneficiary').addEventListener('change',()=>{
  const third=qs('#requestBeneficiary').value==='third_party';
  qs('#requestThirdPartyName').closest('label').classList.toggle('hidden',!third);
  updateSimulation();
});

function updateSimulation(){
  const amount=Number(qs('#requestAmount').value||0);
  const n=Number(qs('#requestInstallments').value||1);
  const third=qs('#requestBeneficiary').value==='third_party';
  const rate=third?Number(state.settings?.third_party_interest_rate??30):Number(state.settings?.operation_interest_rate??25);
  const total=amount*(1+rate/100);
  const available=Number(state.credit?.available_credit||0);
  const over=amount>available&&available>0;
  qs('#loanSimulation').innerHTML=`<span>Taxa: <b>${rate.toLocaleString('pt-BR')}%</b></span><span>Juros: <b>${brl.format(amount*rate/100)}</b></span><span>Total: <b>${brl.format(total)}</b></span><span>${n}x de <b>${brl.format(n?total/n:0)}</b></span>${over?`<span class="simulation-warning">Seu limite atual é ${brl.format(available)}. Você ainda pode enviar a solicitação para análise.</span>`:''}`;
}

qs('#loanRequestForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(isAdmin()){toast('Use um acesso de cotista para solicitar crédito.');return}
  const amount=Number(qs('#requestAmount').value),inst=Number(qs('#requestInstallments').value),benef=qs('#requestBeneficiary').value,third=qs('#requestThirdPartyName').value.trim(),purpose=qs('#requestPurpose').value.trim();
  if(benef==='third_party'&&!third){toast('Informe o nome do terceiro.');return}
  if(benef==='third_party'&&!confirm('Confirmo que continuo integralmente responsável perante a OLIVER Caixinha por este valor, mesmo que o terceiro não pague. A taxa para terceiro é de 30%.'))return;
  const cr=state.credit;
  const payload={
    member_id:state.user.id,requested_amount:amount,requested_installments:inst,beneficiary_type:benef,
    third_party_name:benef==='third_party'?third:null,purpose,
    third_party_responsibility_accepted_at:benef==='third_party'?new Date().toISOString():null,
    eligible_contributions_snapshot:Number(cr?.eligible_contributions||0),
    credit_limit_snapshot:Number(cr?.credit_limit||0),
    used_credit_snapshot:Number(cr?.used_credit||0),
    available_credit_snapshot:Number(cr?.available_credit||0),
    current_share_count_snapshot:Number(cr?.share_count||state.profile?.share_count||1),
    contribution_ok_snapshot:!cr?.has_overdue_contributions,
    activities_ok_snapshot:!cr?.has_overdue_activities,
    loan_history_ok_snapshot:!cr?.has_overdue_loans,
    multi_share_snapshot:Boolean(cr?.has_multiple_shares)
  };
  const {error}=await db.from('loan_requests').insert(payload);
  if(error){toast(error.message);return}
  e.target.reset();qs('#requestThirdPartyName').closest('label').classList.add('hidden');updateSimulation();await renderRequests();
  toast(amount>Number(cr?.available_credit||0)&&Number(cr?.available_credit||0)>0?'Solicitação enviada. O valor está acima do limite e será analisado pela administração.':'Solicitação enviada para análise.');
});

window.acceptAvailableCredit=async requestId=>{
  const {data:r,error}=await db.from('loan_requests').select('*').eq('id',requestId).eq('member_id',state.user.id).single();
  if(error||!r){toast('Solicitação não encontrada.');return}
  const amount=Number(r.available_credit_snapshot||0);
  if(amount<=0){toast('Não há valor disponível para aceitar.');return}
  const payload={
    member_id:state.user.id,
    requested_amount:amount,
    requested_installments:r.requested_installments,
    beneficiary_type:r.beneficiary_type,
    third_party_name:r.third_party_name,
    purpose:`Nova solicitação após ajuste de limite. Origem: ${r.purpose||''}`,
    third_party_responsibility_accepted_at:r.beneficiary_type==='third_party'?new Date().toISOString():null,
    eligible_contributions_snapshot:Number(state.credit?.eligible_contributions||0),
    credit_limit_snapshot:Number(state.credit?.credit_limit||0),
    used_credit_snapshot:Number(state.credit?.used_credit||0),
    available_credit_snapshot:Number(state.credit?.available_credit||0),
    current_share_count_snapshot:Number(state.credit?.share_count||state.profile?.share_count||1),
    contribution_ok_snapshot:!state.credit?.has_overdue_contributions,
    activities_ok_snapshot:!state.credit?.has_overdue_activities,
    loan_history_ok_snapshot:!state.credit?.has_overdue_loans,
    multi_share_snapshot:Boolean(state.credit?.has_multiple_shares)
  };
  const {error:insertError}=await db.from('loan_requests').insert(payload);
  if(insertError){toast(insertError.message);return}
  await renderRequests();toast('Nova solicitação enviada com o valor disponível.');
};

async function renderLoans(){
  const q=db.from('loans').select('*').order('created_at',{ascending:false});
  if(!isAdmin())q.eq('member_id',state.user.id);
  const {data:loans}=await q;
  const allLoans=loans||[];
  const ids=allLoans.map(x=>x.id);
  let installments=[];
  if(ids.length){
    const {data}=await db.from('loan_installments').select('*').in('loan_id',ids).order('installment_number');
    installments=data||[];
  }

  const active=allLoans.filter(l=>['active','late'].includes(l.status));
  const paidLoans=allLoans.filter(l=>l.status==='paid');
  const debt=active.reduce((s,l)=>s+Number(l.outstanding_amount||0),0);
  qs('#loanTotalDebt').textContent=brl.format(debt);
  qs('#loanRate').textContent=`${Number(state.settings?.operation_interest_rate??25).toFixed(2)}% próprio • ${Number(state.settings?.third_party_interest_rate??30).toFixed(2)}% terceiro`;
  const activeIds=new Set(active.map(l=>l.id));
  const pending=installments.filter(i=>activeIds.has(i.loan_id)&&i.status==='pending');
  qs('#loanRemaining').textContent=pending.length;
  qs('#loanInterestEstimate').textContent=brl.format(active.reduce((s,l)=>s+Number(l.interest_amount||0),0));
  if(qs('#activeLoanCount'))qs('#activeLoanCount').textContent=String(active.length);
  if(qs('#paidLoanCount'))qs('#paidLoanCount').textContent=String(paidLoans.length);

  const filter=window.__loanContractFilter||'active';
  qsa('#loanContractTabs .loan-tab').forEach(btn=>{
    const selected=btn.dataset.loanFilter===filter;
    btn.classList.toggle('active',selected);
    btn.setAttribute('aria-selected',String(selected));
  });
  const visible=filter==='paid'?paidLoans:active;

  qs('#loanCards').innerHTML=visible.map(l=>{
    const ins=installments.filter(i=>i.loan_id===l.id);
    const paid=ins.filter(i=>i.status==='confirmed').length;
    const pct=l.installments?Math.min(100,Math.round(paid/l.installments*100)):0;
    const tripLoan=l.source_kind==='trip_overdue';
    const historical=l.source_kind==='historical_2026';
    const rateLabel=historical
      ?`${Number(l.operation_rate).toFixed(2)}% por período • histórico 2026`
      :(tripLoan?'Regra histórica do contrato':`${Number(l.operation_rate).toFixed(2)}%`);
    const origin=historical?'Histórico real de 2026':(tripLoan?'Passeio convertido em empréstimo':(l.beneficiary_type==='third_party'?`Terceiro: ${safe(l.third_party_name)}`:'Empréstimo próprio'));
    const startLabel=l.date_precision==='import_date'
      ?'data exata não informada'
      :(l.date_precision==='month'
        ?new Date(l.released_at+'T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
        :formatDate(l.released_at));
    const isPaid=l.status==='paid';
    const displayValue=isPaid?Number(l.total_contract_amount||0):Number(l.outstanding_amount||0);
    return `<div class="loan-card ${tripLoan?'trip-overdue-loan':''} ${isPaid?'loan-card-paid':''}">
      <div class="loan-card-head">
        <div><h4>${tripLoan?'PASSEIO • ':''}${l.id.slice(0,8).toUpperCase()}</h4><small>${origin} • início ${safe(startLabel)}</small></div>
        ${statusBadge(l.status)}
      </div>
      <div class="big">${brl.format(displayValue)}</div><small>${isPaid?'Total do contrato quitado':'Saldo devedor'}</small>
      <div class="progress"><i style="width:${isPaid?100:pct}%"></i></div>
      <div class="loan-meta">
        <div><span>Progresso</span><b>${isPaid?'Quitado':paid+'/'+l.installments+' parcela(s)'}</b></div>
        <div><span>Total contratado</span><b>${brl.format(Number(l.total_contract_amount||0))}</b></div>
        <div><span>Juros</span><b>${rateLabel}</b></div>
      </div>
      ${tripLoan?`<div class="trip-loan-note">Contrato legado. A nova régua fica desativada em 2026.</div>`:''}
    </div>`;
  }).join('');

  const empty=qs('#loanEmptyState');
  if(empty){
    empty.textContent=filter==='paid'?'Nenhum contrato quitado.':'Nenhum contrato ativo.';
    empty.classList.toggle('hidden',visible.length>0);
  }
}

qs('#loanContractTabs')?.addEventListener('click',e=>{
  const btn=e.target.closest('[data-loan-filter]');
  if(!btn)return;
  window.__loanContractFilter=btn.dataset.loanFilter;
  renderLoans();
});

async function refreshReceiptReference(){
  const kind=qs('#receiptType').value;
  const label=qs('#receiptActivityLabel'),sel=qs('#receiptActivity');
  if(!label||!sel)return;
  label.classList.add('hidden');sel.innerHTML='';

  if(kind==='loan'){
    const {data:loans}=await db.from('loans').select('id,source_kind').eq('member_id',state.user.id).in('status',['active','late']);
    const ids=(loans||[]).map(l=>l.id);
    if(ids.length){
      const {data:rows}=await db.from('loan_installments').select('id,loan_id,due_date,total_amount,amount_paid,status').in('loan_id',ids).eq('status','pending').order('due_date');
      sel.innerHTML=(rows||[]).map(i=>`<option value="loan:${i.id}">${formatDate(i.due_date)} • ${brl.format(Math.max(0,Number(i.total_amount)-Number(i.amount_paid||0)))}</option>`).join('');
      if((rows||[]).length)label.classList.remove('hidden');
    }
  }else if(kind==='draw'||kind==='trip'){
    const {data:entries}=await db.from('activity_entries').select('activity_id,amount_due,amount_paid,status,activities(id,title,type,status,event_at,payment_due_date)').eq('member_id',state.user.id);
    const rows=(entries||[]).filter(e=>e.activities?.type===kind&&e.activities?.status==='open'&&e.status!=='confirmed');
    sel.innerHTML=rows.map(e=>`<option value="activity:${e.activity_id}">${safe(e.activities?.title||'Atividade')} • ${brl.format(Math.max(0,Number(e.amount_due)-Number(e.amount_paid||0)))}</option>`).join('');
    if(rows.length)label.classList.remove('hidden');
  }
}

const RECEIPT_BUCKET='payment-receipts';

function receiptFileKind(filename){
  const ext=String(filename||'').split('.').pop()?.toLowerCase();
  if(['jpg','jpeg','png','webp','gif'].includes(ext))return 'image';
  if(ext==='pdf')return 'pdf';
  return 'file';
}

async function createReceiptSignedUrl(receipt,download=false){
  if(!receipt?.storage_path)throw new Error('Arquivo do comprovante não encontrado.');
  const options=download?{download:receipt.original_filename||true}:undefined;
  const {data,error}=await db.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(receipt.storage_path,download?120:300,options);
  if(error)throw error;
  if(!data?.signedUrl)throw new Error('Não foi possível gerar o acesso ao comprovante.');
  return data.signedUrl;
}

window.downloadReceiptFile=async id=>{
  const receipt=window.__receiptFiles?.[id];
  if(!receipt){toast('Comprovante não encontrado.');return}
  try{
    const url=await createReceiptSignedUrl(receipt,true);
    const a=document.createElement('a');
    a.href=url;
    a.target='_blank';
    a.rel='noopener';
    a.download=receipt.original_filename||'comprovante';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }catch(err){toast(err.message||'Não foi possível baixar o comprovante.')}
};

window.openReceiptFile=async id=>{
  const receipt=window.__receiptFiles?.[id];
  if(!receipt){toast('Comprovante não encontrado.');return}
  try{
    const url=await createReceiptSignedUrl(receipt,false);
    const kind=receiptFileKind(receipt.original_filename);
    const preview=kind==='image'
      ?`<img class="receipt-preview-image" src="${safe(url)}" alt="Comprovante ${safe(receipt.original_filename||'')}" />`
      :kind==='pdf'
        ?`<iframe class="receipt-preview-pdf" src="${safe(url)}" title="Comprovante"></iframe>`
        :`<div class="receipt-generic-file"><span>📎</span><b>${safe(receipt.original_filename||'Arquivo')}</b><p>Use os botões abaixo para abrir ou baixar.</p></div>`;
    openModal(`<div class="receipt-preview-modal">
      <div class="panel-head">
        <div><span class="eyebrow">COMPROVANTE</span><h3>${safe(receipt.original_filename||'Arquivo enviado')}</h3><p>${brl.format(Number(receipt.amount||0))} • ${formatDate(receipt.submitted_at)}</p></div>
        ${statusBadge(receipt.status)}
      </div>
      <div class="receipt-preview-stage">${preview}</div>
      <div class="receipt-preview-actions">
        <a class="outline-btn" href="${safe(url)}" target="_blank" rel="noopener">Abrir em nova aba</a>
        <button class="primary-btn" type="button" onclick="downloadReceiptFile('${receipt.id}')">Baixar arquivo</button>
      </div>
    </div>`);
  }catch(err){toast(err.message||'Não foi possível abrir o comprovante.')}
};

async function renderPayments(){
  qs('#pixKeyText').textContent=state.settings?.pix_key||'58.119.805/0001-39';
  qs('#pixPayload').textContent=state.settings?.pix_base_payload||state.settings?.pix_key||'';
  if(qs('#pixBank'))qs('#pixBank').textContent=state.settings?.bank_name||'Inter';
  if(qs('#pixBankCode'))qs('#pixBankCode').textContent=state.settings?.bank_code||'077';
  if(qs('#pixHolder'))qs('#pixHolder').textContent=state.settings?.pix_receiver_name||'Gabriela Lima Duarte';
  if(qs('#pixAgency'))qs('#pixAgency').textContent=state.settings?.bank_agency||'0001';
  if(qs('#pixAccount'))qs('#pixAccount').textContent=state.settings?.bank_account||'41655540-3';
  const q=db.from('payment_receipts').select('*').order('submitted_at',{ascending:false});
  if(!isAdmin())q.eq('member_id',state.user.id);
  const {data:rows,error}=await q;
  if(error){qs('#paymentHistory').innerHTML='<div class="stack-item"><p>Não foi possível carregar os comprovantes.</p></div>';return}
  window.__receiptFiles=Object.fromEntries((rows||[]).map(r=>[r.id,r]));
  const typeLabel={contribution:'Cota mensal',loan:'Empréstimo',draw:'Rifa',trip:'Passeio',other:'Outro'};
  qs('#paymentHistory').innerHTML=`<table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Comprovante</th><th>Status</th>${isAdmin()?'<th>Ação</th>':''}</tr></thead><tbody>${(rows||[]).map(p=>`<tr>
    <td>${formatDate(p.submitted_at)}</td>
    <td>${safe(typeLabel[p.payment_kind]||p.payment_kind)}</td>
    <td>${brl.format(Number(p.amount))}</td>
    <td><div class="receipt-file-actions"><button class="outline-btn tiny" type="button" onclick="openReceiptFile('${p.id}')">Visualizar</button><button class="ghost-btn tiny" type="button" onclick="downloadReceiptFile('${p.id}')">Baixar</button><small>${safe(p.original_filename||'Arquivo')}</small></div></td>
    <td>${statusBadge(p.status)}</td>
    ${isAdmin()?`<td>${p.status==='pending'?`<div class="row-actions"><button class="primary-btn small" onclick="reviewReceipt('${p.id}',true)">Confirmar</button><button class="outline-btn small" onclick="reviewReceipt('${p.id}',false)">Recusar</button></div>`:'—'}</td>`:''}
  </tr>`).join('')||`<tr><td colspan="${isAdmin()?6:5}">Nenhum comprovante enviado.</td></tr>`}</tbody></table>`;
  enhanceResponsiveTables(qs('#paymentHistory'));
  if(!isAdmin())await refreshReceiptReference();
}

qs('#receiptType').addEventListener('change',refreshReceiptReference);
qs('#copyPixBtn').addEventListener('click',async()=>{try{const value=qs('#pixPayload').textContent||state.settings?.pix_key||'';await navigator.clipboard.writeText(value);toast('Pix Copia e Cola copiado.')}catch{toast('Não foi possível copiar automaticamente.')}});

qs('#receiptForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(isAdmin()){toast('Entre como cotista para anexar comprovante pessoal.');return}
  const file=qs('#receiptFile').files[0];
  if(!file){toast('Selecione um comprovante.');return}
  const ext=(file.name.split('.').pop()||'bin').toLowerCase();
  const name=`${state.user.id}/${crypto.randomUUID()}.${ext}`;
  const {error:upErr}=await db.storage.from('payment-receipts').upload(name,file,{upsert:false});
  if(upErr){toast(upErr.message);return}

  const kind=qs('#receiptType').value;
  let contributionId=null,installmentId=null,activityId=null;

  if(kind==='contribution'){
    const {data:contrib}=await db.from('monthly_contributions').select('id').eq('member_id',state.user.id).eq('reference_month',currentMonthRef).maybeSingle();
    contributionId=contrib?.id||null;
    if(!contributionId){
      await db.storage.from('payment-receipts').remove([name]);
      toast('A cota deste mês ainda não foi gerada pela administração.');
      return;
    }
  }

  if(kind==='loan'){
    const ref=qs('#receiptActivity').value;
    installmentId=ref?.startsWith('loan:')?ref.slice(5):null;
    if(!installmentId){
      await db.storage.from('payment-receipts').remove([name]);
      toast('Selecione a parcela que está pagando.');
      return;
    }
  }

  if(kind==='draw'||kind==='trip'){
    const ref=qs('#receiptActivity').value;
    activityId=ref?.startsWith('activity:')?ref.slice(9):null;
    if(!activityId){
      await db.storage.from('payment-receipts').remove([name]);
      toast('Selecione a atividade referente ao pagamento.');
      return;
    }
  }

  const {error}=await db.from('payment_receipts').insert({
    member_id:state.user.id,contribution_id:contributionId,installment_id:installmentId,activity_id:activityId,
    payment_kind:kind,amount:Number(qs('#receiptAmount').value),storage_path:name,
    original_filename:file.name,note:qs('#receiptNote').value.trim()||null
  });
  if(error){
    await db.storage.from('payment-receipts').remove([name]);toast(error.message);return
  }
  e.target.reset();await renderPayments();toast('Comprovante enviado para conferência.');
});

window.reviewReceipt=async(id,ok)=>{
  const note=ok?'':prompt('Motivo da recusa:')||'';
  const {error}=await db.rpc('admin_confirm_receipt',{p_receipt_id:id,p_confirm:ok,p_note:note});
  if(error){toast(error.message);return}
  await Promise.all([renderPayments(),renderDashboard(),renderLoans(),renderActivities()]);
  toast(ok?'Pagamento confirmado.':'Comprovante recusado.');
};

async function renderActivities(){const {data:acts}=await db.from('activities').select('*').neq('status','draft').order('created_at',{ascending:false});let entries=[];if(isAdmin()&&(acts||[]).length){const {data}=await db.from('activity_entries').select('*').in('activity_id',acts.map(a=>a.id));entries=data||[]}
  qs('#activityCards').innerHTML=(acts||[]).map(a=>{const list=entries.filter(e=>e.activity_id===a.id),raised=list.reduce((s,e)=>s+Number(e.amount_paid||0),0);return `<article class="activity-card"><div class="activity-cover ${a.type==='draw'?'sorteio':'passeio'}"><span>${a.type==='draw'?'SORTEIO':a.type==='trip'?'PASSEIO':'EVENTO'}</span>${statusBadge(a.status)}</div><div class="activity-body"><h4>${safe(a.title)}</h4><p>${safe(a.description||'')}</p><div class="activity-stats"><div><span>Valor</span><b>${brl.format(Number(a.unit_price||0))}</b></div><div><span>${isAdmin()?'Arrecadado':'Meta'}</span><b>${brl.format(isAdmin()?raised:Number(a.target_amount||0))}</b></div><div><span>Status</span><b>${safe(a.status)}</b></div></div></div></article>`}).join('')||'<div class="stack-item"><p>Nenhuma atividade cadastrada.</p></div>'}

async function callAdminUsers(payload){
  const {data:{session}}=await db.auth.getSession();
  if(!session)throw new Error('Sessão expirada. Entre novamente.');
  const r=await fetch(`${cfg.supabaseUrl}/functions/v1/admin-users`,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.supabaseKey,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify(payload)});
  const j=await r.json().catch(()=>({error:'Resposta inválida do servidor.'}));
  if(!r.ok)throw new Error(j.error||'Não foi possível concluir a ação.');
  return j;
}

async function renderMembers(){
  if(!isAdmin())return;
  const [{data:members},{data:contrib},{data:loans},{data:snapshots},{data:annual},{data:credits}] = await Promise.all([
    db.from('profiles').select('*').order('cotista_number',{ascending:true}),
    db.from('monthly_contributions').select('*').eq('reference_month',currentMonthRef),
    db.from('loans').select('member_id,outstanding_amount,status').in('status',['active','late']),
    db.from('member_year_snapshots').select('*').eq('year',now.getFullYear()),
    db.rpc('admin_get_annual_balances',{p_year:now.getFullYear()}),
    db.from('member_credit_summary').select('*')
  ]);
  window.__membersById=Object.fromEntries((members||[]).map(m=>[m.id,m]));
  const annualMap=Object.fromEntries((annual||[]).map(a=>[a.member_id,a]));
  const rows=(members||[]).filter(m=>m.cotista_number!=null).map(m=>{
    const mc=(contrib||[]).find(x=>x.member_id===m.id);
    const debt=(loans||[]).filter(x=>x.member_id===m.id).reduce((s,x)=>s+Number(x.outstanding_amount||0),0);
    const snap=(snapshots||[]).find(x=>x.member_id===m.id);
    const yr=annualMap[m.id];
    const credit=(credits||[]).find(x=>x.member_id===m.id)||null;
    return {m,mc,debt,snap,yr,credit};
  });
  window.__memberAdminData=Object.fromEntries(rows.map(r=>[r.m.id,r]));

  qs('#membersTable').innerHTML=`<table class="data-table member-admin-table compact-members"><thead><tr><th>#</th><th>Cotista</th><th>Pago no ano</th><th>Empréstimo aberto</th><th>Previsão anual</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(({m,mc,debt,snap,yr,credit})=>`<tr>
    <td>${m.cotista_number?String(m.cotista_number).padStart(2,'0'):'ADM'}</td>
    <td><b>${safe(m.full_name)}</b><small>${m.cotista_number?'Cotista':'Administrador'}</small></td>
    <td>${m.cotista_number?(snap?brl.format(Number(snap.contributions_paid||0)):'—'):'—'}</td>
    <td class="${debt>0?'amount out':''}">${m.cotista_number&&debt>0?brl.format(-debt):brl.format(0)}</td>
    <td>${m.cotista_number&&yr?brl.format(Number(yr.estimated_year_end_total||0)):'—'}</td>
    <td>${m.active?statusBadge('active'):statusBadge('cancelled')}</td>
    <td>${m.cotista_number?`<button class="outline-btn tiny" onclick="openMemberAdminDetails('${m.id}')">Ver</button>`:'—'}</td>
  </tr>`).join('')}</tbody></table>`;
  window.__membersCsv=rows.map(r=>r.m);
}

window.openMemberAdminDetails=id=>{
  const row=window.__memberAdminData?.[id];
  if(!row)return;
  const {m,mc,debt,snap,yr,credit}=row;
  const autoLimit=Number(credit?.automatic_credit_limit??credit?.credit_limit??0);
  const effectiveLimit=Number(credit?.credit_limit??0);
  const availableLimit=Number(credit?.available_credit??0);
  const customLimit=credit?.loan_limit_override==null?null:Number(credit.loan_limit_override);
  const annualPaid=Number(snap?.contributions_paid||0);
  const interestRecorded=Number(snap?.interest_recorded||0);
  const chartMax=Math.max(1,annualPaid,debt,interestRecorded,effectiveLimit);
  const pct=v=>Math.max(v>0?4:0,Math.round(Number(v||0)/chartMax*100));
  openModal(`<div class="member-detail-modal">
    <div class="panel-head"><div><span class="eyebrow">COTISTA ${String(m.cotista_number||'').padStart(2,'0')}</span><h3>${safe(m.full_name)}</h3><p>${safe(m.email||'Sem e-mail')}</p></div>${m.active?statusBadge('active'):statusBadge('cancelled')}</div>
    <div class="member-detail-grid">
      <div><span>Cotas pagas ${now.getFullYear()}</span><b>${snap?.paid_share_units??'—'}</b></div>
      <div><span>Total em cotas</span><b>${snap?brl.format(Number(snap.contributions_paid||0)):'—'}</b></div>
      <div><span>Mês atual</span><b>${mc?.status==='confirmed'?brl.format(Number(mc.amount_paid||0)):'Pendente'}</b></div>
      <div><span>Empréstimo aberto</span><b>${debt>0?brl.format(debt):brl.format(0)}</b></div>
      <div><span>Empréstimos no ano</span><b>${snap?brl.format(Number(snap.loan_principal_year||0)):'—'}</b></div>
      <div><span>Juros registrados</span><b>${snap?brl.format(Number(snap.interest_recorded||0)):'—'}</b></div>
      <div><span>Limite automático</span><b>${brl.format(autoLimit)}</b></div>
      <div><span>Limite válido</span><b>${brl.format(effectiveLimit)}</b><small>${customLimit==null?'Automático':'Personalizado pelo ADM'}</small></div>
      <div><span>Crédito disponível</span><b>${brl.format(availableLimit)}</b></div>
      <div class="wide"><span>Previsão fim do ano</span><b>${yr?brl.format(Number(yr.estimated_year_end_total||0)):'—'}</b></div>
    </div>
    <div class="member-mini-chart">
      <h4>Resumo visual</h4>
      <div><span>Cotas pagas</span><i><b style="width:${pct(annualPaid)}%"></b></i><strong>${brl.format(annualPaid)}</strong></div>
      <div><span>Empréstimo aberto</span><i><b style="width:${pct(debt)}%"></b></i><strong>${brl.format(debt)}</strong></div>
      <div><span>Juros registrados</span><i><b style="width:${pct(interestRecorded)}%"></b></i><strong>${brl.format(interestRecorded)}</strong></div>
      <div><span>Limite de crédito</span><i><b style="width:${pct(effectiveLimit)}%"></b></i><strong>${brl.format(effectiveLimit)}</strong></div>
    </div>
    <div class="member-detail-actions">
      <button class="primary-btn" onclick="editMemberCreditLimit('${m.id}')">Editar limite</button>
      <button class="outline-btn" onclick="toggleMemberAccess('${m.id}',${m.active?'false':'true'});closeModal()">${m.active?'Desativar acesso':'Ativar acesso'}</button>
      <button class="outline-btn" onclick="resetMemberPassword('${m.id}')">Redefinir senha</button>
    </div>
  </div>`);
};

qs('#exportMembersBtn').addEventListener('click',()=>{const rows=window.__membersCsv||[];const txt='numero,nome,email,cotas,ativo\n'+rows.map(m=>`${m.cotista_number||''},"${String(m.full_name).replaceAll('"','""')}",${m.email||''},${m.share_count},${m.active?'sim':'nao'}`).join('\n');const blob=new Blob([txt],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cotistas-oliver-caixinha.csv';a.click();URL.revokeObjectURL(a.href)});
qs('#newMemberBtn').addEventListener('click',()=>{if(!isAdmin())return;openModal(`<div class="panel-head"><div><h3>Novo cotista</h3><p>Crie o acesso inicial do cotista. A senha poderá ser alterada pelo próprio usuário em Meu cadastro.</p></div></div><form id="newMemberForm" class="form-grid"><label>Número do cotista<input id="newMemberNumber" type="number" min="1" max="20" required></label><label>Cotas mensais<input id="newMemberShares" type="number" min="1" max="20" value="1" required></label><label class="full-span">Nome completo<input id="newMemberName" required></label><label class="full-span">E-mail de acesso<input id="newMemberEmail" type="email" required></label><label class="full-span">Senha provisória<input id="newMemberPassword" type="text" minlength="8" value="Oliver@2026" required></label><button class="primary-btn full-span" type="submit">Criar cotista</button></form>`);setTimeout(()=>qs('#newMemberForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;try{if(btn){btn.disabled=true;btn.textContent='Criando...'}await callAdminUsers({action:'create_member',cotista_number:Number(qs('#newMemberNumber').value),share_count:Number(qs('#newMemberShares').value),full_name:qs('#newMemberName').value.trim(),email:qs('#newMemberEmail').value.trim().toLowerCase(),password:qs('#newMemberPassword').value});closeModal();await renderMembers();toast('Cotista criado com sucesso.')}catch(err){toast(err.message)}finally{if(btn){btn.disabled=false;btn.textContent='Criar cotista'}}}),0)});
function generateTemporaryPassword(n){const a=new Uint32Array(1);crypto.getRandomValues(a);return `Olv${String(n).padStart(2,'0')}@${a[0].toString(36).toUpperCase().slice(-6)}`}
window.toggleMemberAccess=async(id,active)=>{try{await callAdminUsers({action:'set_active',user_id:id,active});await renderMembers();toast(active?'Acesso ativado.':'Acesso desativado.')}catch(err){toast(err.message)}};
window.editMemberCreditLimit=async id=>{
  const row=window.__memberAdminData?.[id];
  if(!row)return;
  const credit=row.credit||{};
  const current=credit.loan_limit_override==null?'':Number(credit.loan_limit_override).toFixed(2);
  const automatic=Number(credit.automatic_credit_limit??credit.credit_limit??0);
  const raw=prompt(`Limite personalizado para ${row.m.full_name}.\nLimite automático: ${brl.format(automatic)}\n\nDigite o novo limite ou deixe vazio para voltar ao automático:`,current);
  if(raw===null)return;
  const normalized=raw.trim().replace(',','.');
  const value=normalized===''?null:Number(normalized);
  if(value!==null&&(!Number.isFinite(value)||value<0)){toast('Informe um limite válido.');return}
  const {error}=await db.rpc('admin_set_member_credit_limit',{p_member_id:id,p_limit:value});
  if(error){toast(error.message);return}
  closeModal();
  await renderMembers();
  toast(value===null?'Limite voltou ao cálculo automático.':'Limite personalizado atualizado.');
};

window.resetMemberPassword=async(id)=>{const name=window.__membersById?.[id]?.full_name||'cotista';const password=prompt(`Nova senha provisória para ${name} (mínimo 8 caracteres):`,'Oliver@2026');if(!password)return;if(password.length<8){toast('Use ao menos 8 caracteres.');return}try{await callAdminUsers({action:'reset_password',user_id:id,password});await renderMembers();toast('Senha redefinida com sucesso.')}catch(err){toast(err.message)}};

async function renderFinanceAgent(){
  if(!isAdmin())return;
  const {data:events,error}=await db.from('finance_agent_events').select('id,created_at,event_date,reference_month,event_type,amount,status,description,member_id,profiles!finance_agent_events_member_id_fkey(full_name)').order('created_at',{ascending:false}).limit(20);
  if(error){qs('#agentEventsTable').innerHTML='<div class="stack-item"><p>Não foi possível carregar o agente.</p></div>';return}
  const rows=events||[];
  qs('#agentProcessed').textContent=String(rows.filter(e=>e.status==='confirmed'||e.status==='recorded').length);
  qs('#agentReview').textContent=String(rows.filter(e=>e.status==='review').length);
  qs('#agentUnpaid').textContent=String(rows.filter(e=>e.status==='unpaid').length);
  const typeLabel={contribution:'Cota',raffle:'Rifa',trip:'Passeio',loan_release:'Empréstimo',loan_payment:'Pgto. empréstimo',interest:'Juros',prize:'Prêmio',income:'Entrada',expense:'Saída',other:'Outro'};
  qs('#agentEventsTable').innerHTML=`<table class="data-table"><thead><tr><th>Data</th><th>Cotista</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows.map(e=>`<tr><td>${formatDate(e.event_date||e.reference_month||e.created_at)}</td><td>${safe(e.profiles?.full_name||'Geral')}</td><td>${safe(typeLabel[e.event_type]||e.event_type)}</td><td>${safe(e.description)}</td><td>${e.amount==null?'—':brl.format(Number(e.amount))}</td><td>${statusBadge(e.status)}</td><td>${e.status==='review'?`<div class="row-actions"><button class="primary-btn tiny" onclick="confirmAgentEvent('${e.id}')">Confirmar</button><button class="outline-btn tiny" onclick="ignoreAgentEvent('${e.id}')">Ignorar</button></div>`:'—'}</td></tr>`).join('')}</tbody></table>`;
}
window.confirmAgentEvent=async id=>{
  const {error}=await db.from('finance_agent_events').update({status:'confirmed',updated_at:new Date().toISOString()}).eq('id',id);
  if(error){toast(error.message);return}
  await Promise.all([renderFinanceAgent(),renderAdmin(),renderDashboard()]);
  toast('Lançamento confirmado e aplicado.');
};
window.ignoreAgentEvent=async id=>{
  const {error}=await db.from('finance_agent_events').update({status:'void',updated_at:new Date().toISOString()}).eq('id',id);
  if(error){toast(error.message);return}
  await renderFinanceAgent();
  toast('Lançamento ignorado sem alterar o caixa.');
};

async function renderInterestDistributionAudit(){
  if(!isAdmin()||!qs('#interestDistributionAudit'))return;
  const {data,error}=await db.from('interest_distribution_batches')
    .select('*')
    .order('created_at',{ascending:false})
    .limit(12);
  if(error){qs('#interestDistributionAudit').innerHTML='<div class="stack-item"><p>Não foi possível carregar a distribuição.</p></div>';return}
  qs('#interestDistributionAudit').innerHTML=`<table class="data-table"><thead><tr><th>Data</th><th>Juro bruto</th><th>Cotas reais</th><th>Taxa ADM</th><th>Cota virtual ADM</th><th>Cotistas</th><th>Total ADM</th></tr></thead><tbody>${(data||[]).map(b=>{
    const realShares=Number(b.real_share_count??b.participant_count??0);
    const adminFee=b.admin_fee_amount==null?null:Number(b.admin_fee_amount);
    const virtual=b.virtual_share_amount==null?null:Number(b.virtual_share_amount);
    const adminTotal=b.admin_total_amount==null?null:Number(b.admin_total_amount);
    const memberPool=b.real_share_pool==null?Number(b.distributed_amount||0):Number(b.real_share_pool);
    return `<tr><td>${formatDate(b.transaction_date)}</td><td>${brl.format(Number(b.gross_amount||0))}</td><td>${realShares}</td><td>${adminFee==null?'—':brl.format(adminFee)}</td><td>${virtual==null?'—':brl.format(virtual)}</td><td><b>${brl.format(memberPool)}</b></td><td><b>${adminTotal==null?'—':brl.format(adminTotal)}</b></td></tr>`;
  }).join('')}</tbody></table>`;
  enhanceResponsiveTables(qs('#interestDistributionAudit'));
}

async function renderLoanRuleStatus(){
  if(!isAdmin()||!qs('#loanRuleStatus'))return;
  const {data,error}=await db.from('loan_rule_versions').select('*').order('effective_from');
  if(error){qs('#loanRuleStatus').textContent='Não foi possível carregar as versões da régua.';return}
  const current=(data||[]).find(r=>r.enabled);
  const staged=(data||[]).find(r=>r.code==='2027_v1');
  const badge=qs('#loanRuleBadge');
  const btn=qs('#activate2027RuleBtn');
  if(current?.code==='2027_v1'){
    badge.textContent='Ativa';
    badge.className='badge success';
    btn.disabled=true;
    btn.textContent='Régua 2027 ativa';
  }else{
    badge.textContent='Preparada';
    badge.className='badge warning';
    const canActivate=staged&&new Date().toISOString().slice(0,10)>=staged.effective_from;
    btn.disabled=!canActivate;
    btn.textContent=canActivate?'Ativar régua 2027':'Disponível em 08/01/2027';
  }
  qs('#loanRuleStatus').innerHTML=`
    <div><span>Regra ativa</span><b>${safe(current?.title||'Não definida')}</b><small>${current?('vigente desde '+formatDate(current.effective_from)):'—'}</small></div>
    <div><span>Próxima versão</span><b>${safe(staged?.title||'—')}</b><small>Ativação permitida a partir de ${staged?formatDate(staged.effective_from):'—'}</small></div>
    <div><span>Juros base</span><b>${Number(staged?.operation_interest_rate||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%</b><small>até ${Number(staged?.max_installments||3)} parcelas</small></div>
    <div><span>Juro vencido</span><b>${Number(staged?.overdue_interest_days||30)} dias</b><small>acréscimo diário = juro vencido ÷ 30</small></div>`;
}

qs('#activate2027RuleBtn')?.addEventListener('click',async()=>{
  if(!isAdmin())return;
  const btn=qs('#activate2027RuleBtn');
  btn.disabled=true;
  try{
    const {error}=await db.rpc('admin_activate_loan_rule',{p_code:'2027_v1'});
    if(error)throw error;
    await renderLoanRuleStatus();
    toast('Régua 2027 ativada.');
  }catch(err){
    toast(err.message||'Não foi possível ativar a régua.');
    await renderLoanRuleStatus();
  }
});

function updateInterestPolicyPreview(){
  const fee=Math.max(0,Math.min(100,Number(qs('#settingInterestAdminFee')?.value||10)));
  const virtual=Math.max(0,Math.floor(Number(qs('#settingVirtualInterestShares')?.value||1)));
  const box=qs('#interestPolicyPreview');
  if(!box)return;
  box.innerHTML=`<span>Exemplo com R$ 1.000,00 de juros: taxa ADM <b>${brl.format(1000*fee/100)}</b> • saldo para divisão <b>${brl.format(1000*(1-fee/100))}</b> • +${virtual} cota(s) virtual(is) apenas na divisão.</span>`;
}

async function renderAdmin(){
  if(!isAdmin())return;
  qs('#settingShare').value=state.settings?.monthly_share_amount??100;
  qs('#settingRate').value=state.settings?.operation_interest_rate??25;
  qs('#settingPix').value=state.settings?.pix_key??'';
  qs('#settingName').value=state.settings?.fund_name??'OLIVER Caixinha';
  qs('#settingCreditBonus').value=state.settings?.credit_bonus_percent??25;
  qs('#settingMaxInstallments').value=state.settings?.max_installments??3;
  qs('#settingThirdPartyRate').value=state.settings?.third_party_interest_rate??30;
  qs('#settingTripReturn').value=state.settings?.trip_return_percent??'';
  if(qs('#settingInterestAdminFee'))qs('#settingInterestAdminFee').value=state.settings?.interest_admin_fee_percent??10;
  if(qs('#settingVirtualInterestShares'))qs('#settingVirtualInterestShares').value=state.settings?.admin_virtual_interest_shares??1;
  updateInterestPolicyPreview();

  const {data:reqs}=await db.from('loan_requests')
    .select('*,profiles!loan_requests_member_id_fkey(full_name)')
    .in('status',['pending','under_review'])
    .order('requested_at');
  qs('#pendingCount').textContent=`${(reqs||[]).length} pendente${(reqs||[]).length===1?'':'s'}`;
  qs('#adminRequests').innerHTML=(reqs||[]).map(r=>`<div class="stack-item"><div><h4>${safe(r.profiles?.full_name||'Cotista')} • ${brl.format(Number(r.requested_amount))}</h4><p>${r.requested_installments} parcela(s) • ${safe(r.purpose)}${r.beneficiary_type==='third_party'?` • Terceiro: ${safe(r.third_party_name)}`:''}</p></div><div><button class="primary-btn small" onclick="approveRequest('${r.id}')">Aprovar</button> <button class="outline-btn" onclick="rejectRequest('${r.id}')">Recusar</button></div></div>`).join('')||'<div class="stack-item"><p>Nenhuma solicitação aguardando análise.</p></div>';

  const {data:tx}=await db.from('fund_transactions').select('*').order('transaction_date',{ascending:false}).limit(20);
  qs('#adminTransactions').innerHTML=`<table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${(tx||[]).map(t=>`<tr><td>${formatDate(t.transaction_date)}</td><td>${t.direction==='income'?'Entrada':'Saída'}</td><td>${safe(t.category)}</td><td>${safe(t.description)}</td><td class="amount ${t.direction==='income'?'in':'out'}">${t.direction==='income'?'+':'−'} ${brl.format(Number(t.amount))}</td></tr>`).join('')}</tbody></table>`;
  enhanceResponsiveTables(qs('#adminTransactions'));
}

window.approveRequest=async id=>{const def=new Date();def.setMonth(def.getMonth()+1);const due=prompt('Primeiro vencimento (AAAA-MM-DD):',def.toISOString().slice(0,10));if(!due)return;const {error}=await db.rpc('admin_approve_loan_request',{p_request_id:id,p_first_due_date:due});if(error){toast(error.message);return}await renderAll();toast('Empréstimo aprovado e parcelas criadas.')};
window.rejectRequest=async id=>{const reason=prompt('Motivo da recusa:')||'';const {error}=await db.rpc('admin_reject_loan_request',{p_request_id:id,p_reason:reason});if(error){toast(error.message);return}await renderAll();toast('Solicitação recusada.')};
qs('#settingInterestAdminFee')?.addEventListener('input',updateInterestPolicyPreview);
qs('#settingVirtualInterestShares')?.addEventListener('input',updateInterestPolicyPreview);

qs('#settingsForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const tripReturnRaw=qs('#settingTripReturn').value;
  const patch={
    monthly_share_amount:Number(qs('#settingShare').value),
    operation_interest_rate:Number(qs('#settingRate').value),
    pix_key:qs('#settingPix').value.trim()||null,
    fund_name:qs('#settingName').value.trim()||'OLIVER Caixinha',
    credit_bonus_percent:Number(qs('#settingCreditBonus').value)||25,
    max_installments:Math.min(3,Math.max(1,Number(qs('#settingMaxInstallments').value)||3)),
    third_party_interest_rate:Number(qs('#settingThirdPartyRate').value)||30,
    trip_return_percent:tripReturnRaw===''?null:Number(tripReturnRaw),
    interest_admin_fee_percent:Math.max(0,Math.min(100,Number(qs('#settingInterestAdminFee')?.value||10))),
    admin_virtual_interest_shares:Math.max(0,Math.floor(Number(qs('#settingVirtualInterestShares')?.value||1))),
    interest_admin_beneficiary_id:state.settings?.interest_admin_beneficiary_id||state.user.id,
    updated_by:state.user.id
  };
  let {data,error}=await db.from('fund_settings').update(patch).eq('id',1).select().single();
  let interestPolicyPending=false;
  if(error){
    const basePatch={...patch};
    delete basePatch.interest_admin_fee_percent;
    delete basePatch.admin_virtual_interest_shares;
    delete basePatch.interest_admin_beneficiary_id;
    const retry=await db.from('fund_settings').update(basePatch).eq('id',1).select().single();
    if(retry.error){toast(error.message);return}
    data=retry.data;
    error=null;
    interestPolicyPending=true;
  }
  state.settings={
    ...data,
    interest_admin_fee_percent:patch.interest_admin_fee_percent,
    admin_virtual_interest_shares:patch.admin_virtual_interest_shares,
    interest_admin_beneficiary_id:patch.interest_admin_beneficiary_id
  };
  await renderAll();
  e.target.closest('details')?.removeAttribute('open');
  toast(interestPolicyPending?'Configurações gerais salvas. Regra de juros preparada para ativação no banco.':'Configurações atualizadas.');
});
qs('#transactionForm').addEventListener('submit',async e=>{e.preventDefault();const category=qs('#transactionCategory').value;const direction=qs('#transactionType').value;const {error}=await db.from('fund_transactions').insert({direction,category,description:qs('#transactionDescription').value.trim(),amount:Number(qs('#transactionAmount').value),visibility:'shared',created_by:state.user.id});if(error){toast(error.message);return}e.target.reset();e.target.closest('details')?.removeAttribute('open');await Promise.all([renderAdmin(),renderDashboard(),renderInterestDistributionAudit()]);toast(direction==='income'&&category==='interest'?'Juros lançados e distribuídos automaticamente.':'Lançamento registrado.')});

qs('#newActivityBtn').addEventListener('click',()=>{if(!isAdmin()){toast('Somente a administração pode criar atividades.');return}openModal(`<div class="panel-head"><div><h3>Nova atividade</h3><p>Cadastre um sorteio, passeio ou outro evento.</p></div></div><form id="activityForm" class="form-grid"><label>Tipo<select id="actType"><option value="draw">Sorteio</option><option value="trip">Passeio</option><option value="other">Outro</option></select></label><label>Valor<input id="actPrice" type="number" min="0" step="0.01" required></label><label class="full-span">Título<input id="actTitle" required></label><label class="full-span">Descrição<textarea id="actDesc" rows="3"></textarea></label><label>Meta<input id="actGoal" type="number" min="0" step="0.01" value="0"></label><button class="primary-btn full-span" type="submit">Criar atividade</button></form>`)});
function openModal(html){qs('#modalContent').innerHTML=html;qs('#modal').classList.remove('hidden');enhanceResponsiveTables(qs('#modalContent'));setTimeout(()=>{enhanceResponsiveTables(qs('#modalContent'));const f=qs('#activityForm');if(f)f.addEventListener('submit',async e=>{e.preventDefault();const {error}=await db.from('activities').insert({type:qs('#actType').value,title:qs('#actTitle').value.trim(),description:qs('#actDesc').value.trim()||null,unit_price:Number(qs('#actPrice').value),target_amount:Number(qs('#actGoal').value||0),status:'open',created_by:state.user.id});if(error){toast(error.message);return}closeModal();await renderActivities();toast('Atividade criada.')})},0)}
function closeModal(){qs('#modal').classList.add('hidden')}qs('#closeModal').addEventListener('click',closeModal);qs('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});

async function renderAll(){await Promise.all([renderDashboard(),renderRequests(),renderLoans(),renderPayments(),renderActivities()]);if(isAdmin())await Promise.all([renderMembers(),renderAdmin(),renderFinanceAgent(),renderInterestDistributionAudit(),renderLoanRuleStatus()]);if(window.renderAccount)await renderAccount();if(isAdmin()&&window.renderAdminExtras)await renderAdminExtras();applyCollapsiblePanels();enhanceResponsiveTables(document);updateSimulation()}

db.auth.onAuthStateChange((_event,session)=>{if(!session&&state.session){state.session=null;state.user=null;state.profile=null;showLogin()}});
loadCore();
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}
