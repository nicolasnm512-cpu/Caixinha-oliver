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
function showApp(){qs('#termsView').classList.add('hidden');qs('#firstAccessView').classList.add('hidden');qs('#loginView').classList.add('hidden');qs('#appView').classList.remove('hidden');qs('#appView').classList.toggle('is-admin',isAdmin());qs('#sidebarName').textContent=state.profile?.full_name||state.user?.email||'Usuário';qs('#sidebarRole').textContent=isAdmin()?'Administrador':'Cotista';qs('#sidebarAvatar').textContent=isAdmin()?'AD':`C${state.profile?.cotista_number||'–'}`;navigate('dashboard');renderAll()}

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

const pageMeta={dashboard:['Visão geral','Acompanhe sua situação, pagamentos, empréstimos e atividades.'],requests:['Central de solicitações','Solicite empréstimos e acompanhe a análise.'],loans:['Empréstimos','Contratos, parcelas, juros e saldo devedor.'],payments:['Pagamentos e comprovantes','Pague via Pix e envie seu comprovante.'],activities:['Rifas e passeios','Veja suas rifas, números, passeios e pagamentos.'],account:['Meu cadastro','Dados pessoais, segurança e documentos.'],members:['Cotistas','Situação dos participantes.'],admin:['Administração','Configurações, aprovações e lançamentos.']};
function navigate(page){if((page==='members'||page==='admin')&&!isAdmin()){toast('Área exclusiva da administração.');return}qsa('.page').forEach(p=>p.classList.remove('active-page'));qs(`#${page}`)?.classList.add('active-page');qsa('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));qs('#pageTitle').textContent=pageMeta[page]?.[0]||'OLIVER Caixinha';qs('#pageSubtitle').textContent=pageMeta[page]?.[1]||'';window.scrollTo({top:0,behavior:'smooth'})}

async function renderDashboard(){
  const baseQueries=[
    db.from('member_credit_summary').select('*').eq('member_id',state.user.id).maybeSingle(),
    db.from('monthly_contributions').select('*').eq('member_id',state.user.id).eq('reference_month',currentMonthRef).maybeSingle(),
    db.from('loans').select('id,outstanding_amount,status').in('status',['active','late'])
  ];
  const [{data:credit},{data:myContribution},{data:loans}] = await Promise.all(baseQueries);
  state.credit=credit;

  if(isAdmin()){
    const [{data:summary},{data:tx},{count},{data:monthContrib}] = await Promise.all([
      db.from('shared_fund_summary').select('*').maybeSingle(),
      db.from('fund_transactions').select('*').order('transaction_date',{ascending:false}).limit(8),
      db.from('profiles').select('id',{count:'exact',head:true}).eq('active',true).not('cotista_number','is',null),
      db.from('monthly_contributions').select('amount_paid,status').eq('reference_month',currentMonthRef)
    ]);

    qs('#fundBalance').textContent=brl.format(Number(summary?.cash_balance||0));
    qs('#kpiMembers').textContent=`${count||0}/20`;
    const confirmed=(monthContrib||[]).filter(x=>x.status==='confirmed');
    qs('#kpiContributions').textContent=brl.format(confirmed.reduce((s,x)=>s+Number(x.amount_paid||0),0));
    qs('#kpiContributionStatus').textContent=`${confirmed.length} cotista(s) confirmado(s)`;
    qs('#kpiInterest').textContent=brl.format(Number(summary?.interest_received||0));
    const totalDebt=(loans||[]).reduce((s,l)=>s+Number(l.outstanding_amount||0),0);
    qs('#kpiLoans').textContent=brl.format(totalDebt);
    qs('#kpiLoanCount').textContent=`${(loans||[]).length} contrato(s) ativo(s)`;

    qs('#recentTransactions').innerHTML=(tx||[]).map(t=>`<div class="transaction"><div class="transaction-meta"><div class="tx-icon">${t.direction==='income'?'↙':'↗'}</div><div><b>${safe(t.description)}</b><small>${formatDate(t.transaction_date)} • ${safe(t.category)}</small></div></div><b class="amount ${t.direction==='income'?'in':'out'}">${t.direction==='income'?'+':'−'} ${brl.format(Number(t.amount))}</b></div>`).join('')||'<div class="stack-item"><p>Nenhuma movimentação registrada.</p></div>';

    const months=[];for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString('pt-BR',{month:'short'}),value:0})}
    (tx||[]).forEach(t=>{const m=months.find(x=>t.transaction_date?.startsWith(x.key));if(m)m.value+=t.direction==='income'?Number(t.amount):-Number(t.amount)});
    const max=Math.max(1,...months.map(x=>Math.abs(x.value)));
    qs('#chart').innerHTML=months.map(m=>`<div class="bar-col"><div class="bar" data-value="${brl.format(m.value)}" style="height:${Math.max(12,Math.round(Math.abs(m.value)/max*170))}px"></div><span>${m.label}</span></div>`).join('');
  }

  qs('#myMonthlyShare').textContent=brl.format(Number(state.settings?.monthly_share_amount||100)*(Number(state.profile?.share_count)||1));
  qs('#myContributionState').textContent=myContribution?.status==='confirmed'?'Paga neste mês':'Pendente neste mês';
  qs('#myStatusBadge').className=`badge ${myContribution?.status==='confirmed'?'success':'warning'}`;
  qs('#myStatusBadge').textContent=myContribution?.status==='confirmed'?'Em dia':'Pendente';

  const myDebt=(loans||[]).reduce((s,l)=>s+Number(l.outstanding_amount||0),0);
  qs('#myLoanBalance').textContent=brl.format(myDebt);
  qs('#myLoanState').textContent=(loans||[]).length?`${loans.length} contrato(s)`:'Sem empréstimos ativos';

  const {data:nextInst}=await db.from('loan_installments').select('due_date,total_amount,amount_paid,status,loan_id').eq('status','pending').order('due_date',{ascending:true}).limit(1).maybeSingle();
  qs('#myNextDue').textContent=nextInst?formatDate(nextInst.due_date):'—';
  qs('#myNextAmount').textContent=nextInst?brl.format(Math.max(0,Number(nextInst.total_amount)-Number(nextInst.amount_paid||0))):'Sem parcela pendente';

  if(!isAdmin()){
    const {data:annual,error:annualError}=await db.rpc('get_my_annual_balance',{p_year:now.getFullYear()});
    const a=Array.isArray(annual)?annual[0]:annual;
    if(!annualError&&a){
      qs('#annualBalanceYear').textContent=String(a.year);
      qs('#annualBalanceTotal').textContent=brl.format(Number(a.estimated_year_end_total||0));
      qs('#annualContributions').textContent=brl.format(Number(a.contributions_paid||0));
      qs('#annualOwnInterestBonus').textContent=brl.format(Number(a.own_interest_bonus||0));
      qs('#annualCollectiveShare').textContent=brl.format(Number(a.collective_interest_share||0));
      qs('#annualCollectivePercent').textContent=`${Number(a.collective_share_percent||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}% da divisão por cota`;
      qs('#annualTripsPaid').textContent=brl.format(Number(a.trips_paid||0));
      const tripReturn=Number(a.trip_return||0);
      qs('#annualTripReturnNote').textContent=tripReturn>0?`Retorno calculado: ${brl.format(tripReturn)}`:'Retorno do passeio aguardando percentual definido';
    }
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
      : Number(state.settings?.operation_interest_rate??20);
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
  const rate=third?Number(state.settings?.third_party_interest_rate??30):Number(state.settings?.operation_interest_rate??20);
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
  const ids=(loans||[]).map(x=>x.id);
  let installments=[];
  if(ids.length){
    const {data}=await db.from('loan_installments').select('*').in('loan_id',ids).order('installment_number');
    installments=data||[];
  }

  const active=(loans||[]).filter(l=>['active','late'].includes(l.status));
  const debt=active.reduce((s,l)=>s+Number(l.outstanding_amount||0),0);
  qs('#loanTotalDebt').textContent=brl.format(debt);
  qs('#loanRate').textContent=`${Number(state.settings?.operation_interest_rate??20).toFixed(2)}% próprio • ${Number(state.settings?.third_party_interest_rate??30).toFixed(2)}% terceiro`;
  const pending=installments.filter(i=>i.status==='pending');
  qs('#loanRemaining').textContent=pending.length;
  qs('#loanInterestEstimate').textContent=brl.format(active.reduce((s,l)=>s+Number(l.interest_amount||0),0));

  qs('#loanCards').innerHTML=(loans||[]).map(l=>{
    const ins=installments.filter(i=>i.loan_id===l.id);
    const paid=ins.filter(i=>i.status==='confirmed').length;
    const pct=l.installments?Math.round(paid/l.installments*100):0;
    const tripLoan=l.source_kind==='trip_overdue';
    const rateLabel=tripLoan
      ?`${Number(l.daily_interest_rate||1).toLocaleString('pt-BR')}% ao dia`
      :`${Number(l.operation_rate).toFixed(2)}%`;
    const origin=tripLoan?'Passeio obrigatório não pago':(l.beneficiary_type==='third_party'?`Terceiro: ${safe(l.third_party_name)}`:'Empréstimo próprio');
    return `<div class="loan-card ${tripLoan?'trip-overdue-loan':''}">
      <div class="loan-card-head">
        <div><h4>${tripLoan?'PASSEIO • ':''}${l.id.slice(0,8).toUpperCase()}</h4><small>${origin} • início ${formatDate(l.released_at)}</small></div>
        ${statusBadge(l.status)}
      </div>
      <div class="big">${brl.format(Number(l.outstanding_amount||0))}</div><small>Saldo devedor</small>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="loan-meta">
        <div><span>Progresso</span><b>${paid}/${l.installments} parcela(s)</b></div>
        <div><span>Total acumulado</span><b>${brl.format(Number(l.total_contract_amount||0))}</b></div>
        <div><span>Juros</span><b>${rateLabel}</b></div>
      </div>
      ${tripLoan?`<div class="trip-loan-note">Os juros são atualizados diariamente sobre o principal ainda em aberto.</div>`:''}
    </div>`;
  }).join('')||'<div class="stack-item"><p>Nenhum empréstimo cadastrado.</p></div>';
}

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

async function renderPayments(){
  qs('#pixKeyText').textContent=state.settings?.pix_key||'Aguardando configuração';
  qs('#pixPayload').textContent=state.settings?.pix_key||'Configure a chave Pix na administração';
  const q=db.from('payment_receipts').select('*').order('submitted_at',{ascending:false});
  if(!isAdmin())q.eq('member_id',state.user.id);
  const {data:rows}=await q;
  qs('#paymentHistory').innerHTML=`<table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Arquivo</th><th>Status</th>${isAdmin()?'<th>Ação</th>':''}</tr></thead><tbody>${(rows||[]).map(p=>`<tr><td>${formatDate(p.submitted_at)}</td><td>${safe(p.payment_kind)}</td><td>${brl.format(Number(p.amount))}</td><td>${safe(p.original_filename||'Arquivo')}</td><td>${statusBadge(p.status)}</td>${isAdmin()?`<td>${p.status==='pending'?`<button class="primary-btn small" onclick="reviewReceipt('${p.id}',true)">Confirmar</button> <button class="outline-btn" onclick="reviewReceipt('${p.id}',false)">Recusar</button>`:'—'}</td>`:''}</tr>`).join('')||`<tr><td colspan="${isAdmin()?6:5}">Nenhum comprovante enviado.</td></tr>`}</tbody></table>`;
  if(!isAdmin())await refreshReceiptReference();
}

qs('#receiptType').addEventListener('change',refreshReceiptReference);
qs('#copyPixBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(qs('#pixPayload').textContent);toast('Chave Pix copiada.')}catch{toast('Copie a chave exibida na tela.')}});

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
  const [{data:members},{data:contrib},{data:loans},{data:snapshots}] = await Promise.all([
    db.from('profiles').select('*').order('cotista_number',{ascending:true}),
    db.from('monthly_contributions').select('*').eq('reference_month',currentMonthRef),
    db.from('loans').select('member_id,outstanding_amount,status').in('status',['active','late']),
    db.from('member_year_snapshots').select('*').eq('year',2026)
  ]);
  window.__membersById=Object.fromEntries((members||[]).map(m=>[m.id,m]));
  qs('#membersTable').innerHTML=`<table class="data-table member-admin-table"><thead><tr><th>#</th><th>Cotista</th><th>Cotas pagas 2026</th><th>Total em cotas</th><th>Empréstimos no ano</th><th>Juros registrados</th><th>${currentMonthLabel}</th><th>Empréstimo aberto</th><th>Acesso</th><th>Ações</th></tr></thead><tbody>${(members||[]).map(m=>{const c=(contrib||[]).find(x=>x.member_id===m.id),debt=(loans||[]).filter(x=>x.member_id===m.id).reduce((s,x)=>s+Number(x.outstanding_amount),0),snap=(snapshots||[]).find(x=>x.member_id===m.id);return `<tr><td>${m.cotista_number?String(m.cotista_number).padStart(2,'0'):'ADM'}</td><td><b>${safe(m.full_name)}</b><br><small>${safe(m.email||'')}</small>${m.must_change_password?'<br><small class="first-access-note">Primeiro acesso pendente</small>':''}</td><td>${snap?.paid_share_units??'—'}</td><td>${snap?brl.format(Number(snap.contributions_paid||0)):'—'}</td><td>${snap?brl.format(Number(snap.loan_principal_year||0)):'—'}</td><td>${snap?brl.format(Number(snap.interest_recorded||0)):'—'}</td><td>${c?.status==='confirmed'?brl.format(Number(c.amount_paid||0)):'Pendente'}</td><td>${brl.format(debt)}</td><td>${m.active?statusBadge('active'):statusBadge('cancelled')}</td><td>${m.cotista_number?`<div class="row-actions"><button class="outline-btn tiny" onclick="toggleMemberAccess('${m.id}',${m.active?'false':'true'})">${m.active?'Desativar':'Ativar'}</button><button class="outline-btn tiny" onclick="resetMemberPassword('${m.id}')">Senha</button></div>`:'—'}</td></tr>`}).join('')}</tbody></table>`;
  window.__membersCsv=members||[];
}
qs('#exportMembersBtn').addEventListener('click',()=>{const rows=window.__membersCsv||[];const txt='numero,nome,email,cotas,ativo\n'+rows.map(m=>`${m.cotista_number||''},"${String(m.full_name).replaceAll('"','""')}",${m.email||''},${m.share_count},${m.active?'sim':'nao'}`).join('\n');const blob=new Blob([txt],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cotistas-oliver-caixinha.csv';a.click();URL.revokeObjectURL(a.href)});
qs('#newMemberBtn').addEventListener('click',()=>{if(!isAdmin())return;openModal(`<div class="panel-head"><div><h3>Novo cotista</h3><p>Crie o acesso inicial. A senha será obrigatoriamente trocada no primeiro login.</p></div></div><form id="newMemberForm" class="form-grid"><label>Número do cotista<input id="newMemberNumber" type="number" min="1" max="20" required></label><label>Cotas mensais<input id="newMemberShares" type="number" min="1" max="20" value="1" required></label><label class="full-span">Nome completo<input id="newMemberName" required></label><label class="full-span">E-mail de acesso<input id="newMemberEmail" type="email" required></label><label class="full-span">Senha provisória<input id="newMemberPassword" type="text" minlength="8" value="Oliver@2026" required></label><button class="primary-btn full-span" type="submit">Criar cotista</button></form>`);setTimeout(()=>qs('#newMemberForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;try{if(btn){btn.disabled=true;btn.textContent='Criando...'}await callAdminUsers({action:'create_member',cotista_number:Number(qs('#newMemberNumber').value),share_count:Number(qs('#newMemberShares').value),full_name:qs('#newMemberName').value.trim(),email:qs('#newMemberEmail').value.trim().toLowerCase(),password:qs('#newMemberPassword').value});closeModal();await renderMembers();toast('Cotista criado com sucesso.')}catch(err){toast(err.message)}finally{if(btn){btn.disabled=false;btn.textContent='Criar cotista'}}}),0)});
function generateTemporaryPassword(n){const a=new Uint32Array(1);crypto.getRandomValues(a);return `Olv${String(n).padStart(2,'0')}@${a[0].toString(36).toUpperCase().slice(-6)}`}
qs('#import2026Btn').addEventListener('click',async()=>{
  if(!isAdmin())return;
  if(!confirm('Importar os 8 cotistas e o resumo financeiro de 2026 informado?'))return;
  const seed=[
    {n:1,name:'Sica',email:'sica@cotista.olivercaixinha.example',paid:9,contribution:900,loans:325,interest:106.25},
    {n:2,name:'Gisele',email:'gisele@cotista.olivercaixinha.example',paid:8,contribution:800,loans:600,interest:145},
    {n:3,name:'Anderson',email:'anderson@cotista.olivercaixinha.example',paid:9,contribution:900,loans:500,interest:120},
    {n:4,name:'Tayna',email:'tayna@cotista.olivercaixinha.example',paid:8,contribution:800,loans:938.75,interest:319.36},
    {n:5,name:'Day',email:'day@cotista.olivercaixinha.example',paid:7,contribution:700,loans:128,interest:41.90},
    {n:6,name:'Jamaica',email:'jamaica@cotista.olivercaixinha.example',paid:30,contribution:3000,loans:0,interest:0},
    {n:7,name:'Regiane',email:'regiane@cotista.olivercaixinha.example',paid:10,contribution:1000,loans:0,interest:0},
    {n:8,name:'Ivan',email:'ivan@cotista.olivercaixinha.example',paid:10,contribution:1000,loans:0,interest:0}
  ];
  const btn=qs('#import2026Btn');const original=btn.textContent;btn.disabled=true;btn.textContent='Importando...';
  const credentials=[];
  try{
    for(const m of seed){
      const password=generateTemporaryPassword(m.n);let created=false;
      try{await callAdminUsers({action:'create_member',cotista_number:m.n,share_count:1,full_name:m.name,email:m.email,password});created=true}catch(createErr){const {data:existing}=await db.from('profiles').select('id').eq('email',m.email).maybeSingle();if(!existing)throw createErr}
      const {data:profile,error:profileError}=await db.from('profiles').select('id').eq('email',m.email).single();if(profileError||!profile)throw new Error(`Perfil de ${m.name} não encontrado.`);
      const {error:snapshotError}=await db.from('member_year_snapshots').upsert({year:2026,member_id:profile.id,paid_share_units:m.paid,contributions_paid:m.contribution,loan_principal_year:m.loans,interest_recorded:m.interest,source_note:'Importado do relatório financeiro janeiro-setembro enviado em 24/09/2026.'},{onConflict:'year,member_id'});if(snapshotError)throw snapshotError;
      credentials.push({name:m.name,email:m.email,password:created?password:'Já cadastrado'});
    }
    await renderMembers();
    openModal(`<div class="panel-head"><div><h3>Importação concluída</h3><p>Guarde as senhas provisórias dos novos acessos. Elas não ficam salvas em texto no banco.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Cotista</th><th>Login</th><th>Senha provisória</th></tr></thead><tbody>${credentials.map(c=>`<tr><td>${safe(c.name)}</td><td>${safe(c.email)}</td><td><b>${safe(c.password)}</b></td></tr>`).join('')}</tbody></table></div><p class="muted-note">No primeiro login, cada cotista será obrigado a criar uma nova senha.</p>`);
    toast('8 cotistas e histórico 2026 processados.');
  }catch(err){toast(err.message||'Falha na importação.')}finally{btn.disabled=false;btn.textContent=original}
});
window.toggleMemberAccess=async(id,active)=>{try{await callAdminUsers({action:'set_active',user_id:id,active});await renderMembers();toast(active?'Acesso ativado.':'Acesso desativado.')}catch(err){toast(err.message)}};
window.resetMemberPassword=async(id)=>{const name=window.__membersById?.[id]?.full_name||'cotista';const password=prompt(`Nova senha provisória para ${name} (mínimo 8 caracteres):`,'Oliver@2026');if(!password)return;if(password.length<8){toast('Use ao menos 8 caracteres.');return}try{await callAdminUsers({action:'reset_password',user_id:id,password});await renderMembers();toast('Senha provisória redefinida. O cotista deverá trocá-la no próximo login.')}catch(err){toast(err.message)}};

async function renderFinanceAgent(){
  if(!isAdmin())return;
  const {data:events,error}=await db.from('finance_agent_events').select('id,created_at,event_date,reference_month,event_type,amount,status,description,member_id,profiles!finance_agent_events_member_id_fkey(full_name)').order('created_at',{ascending:false}).limit(40);
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

async function renderAdmin(){if(!isAdmin())return;qs('#settingShare').value=state.settings?.monthly_share_amount??100;qs('#settingRate').value=state.settings?.operation_interest_rate??20;qs('#settingPix').value=state.settings?.pix_key??'';qs('#settingName').value=state.settings?.fund_name??'OLIVER Caixinha';qs('#settingCreditBonus').value=state.settings?.credit_bonus_percent??25;qs('#settingMaxInstallments').value=state.settings?.max_installments??3;qs('#settingThirdPartyRate').value=state.settings?.third_party_interest_rate??30;qs('#settingOwnInterestReturn').value=state.settings?.own_interest_return_percent??10;qs('#settingTripReturn').value=state.settings?.trip_return_percent??'';const {data:reqs}=await db.from('loan_requests').select('*,profiles!loan_requests_member_id_fkey(full_name)').in('status',['pending','under_review']).order('requested_at');qs('#pendingCount').textContent=`${(reqs||[]).length} pendente${(reqs||[]).length===1?'':'s'}`;qs('#adminRequests').innerHTML=(reqs||[]).map(r=>`<div class="stack-item"><div><h4>${safe(r.profiles?.full_name||'Cotista')} • ${brl.format(Number(r.requested_amount))}</h4><p>${r.requested_installments} parcela(s) • ${safe(r.purpose)}${r.beneficiary_type==='third_party'?` • Terceiro: ${safe(r.third_party_name)}`:''}</p></div><div><button class="primary-btn small" onclick="approveRequest('${r.id}')">Aprovar</button> <button class="outline-btn" onclick="rejectRequest('${r.id}')">Recusar</button></div></div>`).join('')||'<div class="stack-item"><p>Nenhuma solicitação aguardando análise.</p></div>';const {data:tx}=await db.from('fund_transactions').select('*').order('transaction_date',{ascending:false}).limit(40);qs('#adminTransactions').innerHTML=`<table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${(tx||[]).map(t=>`<tr><td>${formatDate(t.transaction_date)}</td><td>${t.direction==='income'?'Entrada':'Saída'}</td><td>${safe(t.category)}</td><td>${safe(t.description)}</td><td class="amount ${t.direction==='income'?'in':'out'}">${t.direction==='income'?'+':'−'} ${brl.format(Number(t.amount))}</td></tr>`).join('')}</tbody></table>`}
window.approveRequest=async id=>{const def=new Date();def.setMonth(def.getMonth()+1);const due=prompt('Primeiro vencimento (AAAA-MM-DD):',def.toISOString().slice(0,10));if(!due)return;const {error}=await db.rpc('admin_approve_loan_request',{p_request_id:id,p_first_due_date:due});if(error){toast(error.message);return}await renderAll();toast('Empréstimo aprovado e parcelas criadas.')};
window.rejectRequest=async id=>{const reason=prompt('Motivo da recusa:')||'';const {error}=await db.rpc('admin_reject_loan_request',{p_request_id:id,p_reason:reason});if(error){toast(error.message);return}await renderAll();toast('Solicitação recusada.')};
qs('#settingsForm').addEventListener('submit',async e=>{e.preventDefault();const tripReturnRaw=qs('#settingTripReturn').value;const patch={monthly_share_amount:Number(qs('#settingShare').value),operation_interest_rate:Number(qs('#settingRate').value),pix_key:qs('#settingPix').value.trim()||null,fund_name:qs('#settingName').value.trim()||'OLIVER Caixinha',credit_bonus_percent:Number(qs('#settingCreditBonus').value)||25,max_installments:Math.min(3,Math.max(1,Number(qs('#settingMaxInstallments').value)||3)),third_party_interest_rate:Number(qs('#settingThirdPartyRate').value)||30,own_interest_return_percent:Number(qs('#settingOwnInterestReturn').value)||10,trip_return_percent:tripReturnRaw===''?null:Number(tripReturnRaw),updated_by:state.user.id};const {data,error}=await db.from('fund_settings').update(patch).eq('id',1).select().single();if(error){toast(error.message);return}state.settings=data;await renderAll();toast('Configurações atualizadas.')});
qs('#transactionForm').addEventListener('submit',async e=>{e.preventDefault();const {error}=await db.from('fund_transactions').insert({direction:qs('#transactionType').value,category:qs('#transactionCategory').value,description:qs('#transactionDescription').value.trim(),amount:Number(qs('#transactionAmount').value),visibility:'shared',created_by:state.user.id});if(error){toast(error.message);return}e.target.reset();await Promise.all([renderAdmin(),renderDashboard()]);toast('Lançamento registrado.')});

qs('#newActivityBtn').addEventListener('click',()=>{if(!isAdmin()){toast('Somente a administração pode criar atividades.');return}openModal(`<div class="panel-head"><div><h3>Nova atividade</h3><p>Cadastre um sorteio, passeio ou outro evento.</p></div></div><form id="activityForm" class="form-grid"><label>Tipo<select id="actType"><option value="draw">Sorteio</option><option value="trip">Passeio</option><option value="other">Outro</option></select></label><label>Valor<input id="actPrice" type="number" min="0" step="0.01" required></label><label class="full-span">Título<input id="actTitle" required></label><label class="full-span">Descrição<textarea id="actDesc" rows="3"></textarea></label><label>Meta<input id="actGoal" type="number" min="0" step="0.01" value="0"></label><button class="primary-btn full-span" type="submit">Criar atividade</button></form>`)});
function openModal(html){qs('#modalContent').innerHTML=html;qs('#modal').classList.remove('hidden');setTimeout(()=>{const f=qs('#activityForm');if(f)f.addEventListener('submit',async e=>{e.preventDefault();const {error}=await db.from('activities').insert({type:qs('#actType').value,title:qs('#actTitle').value.trim(),description:qs('#actDesc').value.trim()||null,unit_price:Number(qs('#actPrice').value),target_amount:Number(qs('#actGoal').value||0),status:'open',created_by:state.user.id});if(error){toast(error.message);return}closeModal();await renderActivities();toast('Atividade criada.')})},0)}
function closeModal(){qs('#modal').classList.add('hidden')}qs('#closeModal').addEventListener('click',closeModal);qs('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});

async function renderAll(){await Promise.all([renderDashboard(),renderRequests(),renderLoans(),renderPayments(),renderActivities()]);if(isAdmin())await Promise.all([renderMembers(),renderAdmin(),renderFinanceAgent()]);if(window.renderAccount)await renderAccount();if(isAdmin()&&window.renderAdminExtras)await renderAdminExtras();updateSimulation()}

db.auth.onAuthStateChange((_event,session)=>{if(!session&&state.session){state.session=null;state.user=null;state.profile=null;showLogin()}});
loadCore();