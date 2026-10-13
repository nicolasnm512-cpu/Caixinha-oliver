
(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const q=(s)=>$(s);
  const text=(sel)=>q(sel)?.textContent?.trim()||'R$ 0,00';
  const num=(sel)=>Number(String(q(sel)?.textContent||'0').replace(/[^0-9-]/g,''))||0;
  const cashVal=(v)=>Math.abs(Number(String(v||'0').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.'))||0);
  const greeting=()=>{const h=new Date().getHours();return h<12?'Olá, bom dia':h<18?'Olá, boa tarde':'Olá, boa noite'};
  const now=()=>new Date().toLocaleString('pt-BR',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  const admin=()=>q('#appView')?.classList.contains('is-admin');
  const go=(page)=>document.querySelector('[data-page="'+page+'"]')?.click();
  function set(el,val){if(el&&el.textContent!==String(val))el.textContent=String(val)}

  function mount(){
    const d=q('#dashboard'); if(!d||q('#adminPremiumV18')) return;
    const el=document.createElement('section');
    el.id='adminPremiumV18';el.className='admin-premium-v18 admin-only';
    el.innerHTML=`
      <div class="adm18-header">
        <div class="adm18-brand">
          <img src="/assets/oliver-logo.svg" alt="OLIVER">
          <div><h1>OLIVER <span>Administração</span></h1><p>Painel administrativo financeiro</p></div>
        </div>
        <span class="adm18-role">♛ Administrador</span>
      </div>
      <section class="adm18-welcome">
        <div><small id="adm18Greeting">Olá</small><h2 id="adm18Name">Administrador</h2><p>Visão geral da OLIVER Caixinha e do que precisa da sua atenção.</p></div>
        <div id="adm18Date" class="adm18-date"></div>
      </section>
      <div class="adm18-grid">
        <button class="adm18-card cash" data-go="admin"><span class="icon">◉</span><span>Caixa disponível</span><strong id="adm18Cash">R$ 0,00</strong><small>Saldo atual disponível</small></button>
        <button class="adm18-card" data-go="loans"><span class="icon">↗</span><span>Total emprestado</span><strong id="adm18Loan">R$ 0,00</strong><small>Capital em contratos ativos</small></button>
        <button class="adm18-card" data-go="payments"><span class="icon">↑</span><span>Entradas confirmadas</span><strong id="adm18Income">R$ 0,00</strong><small>Cotas, rifas, passeios e recebimentos</small></button>
        <button class="adm18-card alert" data-go="admin"><span class="icon">!</span><span>Pendências</span><strong id="adm18Pending">0</strong><small id="adm18PendingText">Nenhuma ação pendente</small></button>
      </div>
      <section class="adm18-section">
        <div class="adm18-section-head"><div><h3>▥ Visão financeira</h3><p>Entradas, saídas, empréstimos, caixa e juros em uma única leitura.</p></div><button data-go="admin">Detalhes</button></div>
        <div class="adm18-chart"><div class="adm18-chart-bars">
          ${['Entradas','Saídas','Emprestado','Caixa','Juros'].map((x,i)=>`<div class="adm18-baritem"><div class="adm18-value" id="adm18v${i}">R$ 0,00</div><div class="adm18-barbox"><div class="adm18-bar" id="adm18b${i}" style="height:10%"></div></div><div class="adm18-label">${x}</div></div>`).join('')}
        </div></div>
      </section>
      <section class="adm18-section">
        <div class="adm18-section-head"><div><h3>⚠ Atenção agora</h3><p>Somente itens que podem exigir ação administrativa.</p></div><button data-go="admin">Ver central</button></div>
        <div class="adm18-attention">
          <button class="adm18-attn" data-go="payments"><span class="row"><span>▤</span><span id="adm18Receipts" class="adm18-badge">0</span></span><b>Comprovantes</b><small>Aguardando validação</small></button>
          <button class="adm18-attn" data-go="admin"><span class="row"><span>↗</span><span id="adm18Requests" class="adm18-badge">0</span></span><b>Empréstimos aguardando</b><small>Análise e aprovação</small></button>
          <button class="adm18-attn" data-go="members"><span class="row"><span>◎</span><span class="adm18-badge">↻</span></span><b>Cadastro dos cotistas</b><small>Acesso, dados e situação individual</small></button>
          <button class="adm18-attn" data-go="payments"><span class="row"><span>▣</span><span class="adm18-badge">Mês</span></span><b>Cotas e vencimentos</b><small>Conferência do período</small></button>
        </div>
      </section>
      <section class="adm18-section">
        <div class="adm18-section-head"><div><h3>⚡ Ações rápidas</h3><p>Todas as funções existentes continuam disponíveis.</p></div></div>
        <div class="adm18-actions">
          <button class="adm18-action" data-go="members"><span><i>◎</i>Cotistas</span><b>›</b></button>
          <button class="adm18-action" data-go="payments"><span><i>▤</i>Comprovantes</span><b>›</b></button>
          <button class="adm18-action" data-go="loans"><span><i>↗</i>Empréstimos</span><b>›</b></button>
          <button class="adm18-action" data-go="activities"><span><i>★</i>Rifas e passeios</span><b>›</b></button>
          <button class="adm18-action" data-go="admin"><span><i>▥</i>Rendimentos</span><b>›</b></button>
          <button class="adm18-action" data-go="admin"><span><i>▣</i>Relatórios e controles</span><b>›</b></button>
        </div>
      </section>
      <section class="adm18-ai">
        <div class="orb">🤖</div><div><h3>Oliver ADM</h3><p>Consultas e operações administrativas com confirmação.</p></div><button id="adm18OpenAi">Conversar agora ›</button>
      </section>
      <nav class="adm18-mobile-nav">
        <button class="active" data-go="dashboard"><i>⌂</i>Início</button>
        <button data-go="members"><i>◎</i>Cotistas</button>
        <button data-go="loans"><i>↗</i>Empréstimos</button>
        <button data-go="activities"><i>★</i>Eventos</button>
        <button data-go="admin"><i>⚙</i>Mais</button>
      </nav>`;
    d.prepend(el);
    el.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go)});
    q('#adm18OpenAi')?.addEventListener('click',()=>q('#adminAgentPanel')?.classList.remove('hidden'));
  }
  function syncGreeting(){
    const h=q('#homeGreeting');if(h)set(h,greeting());
  }
  function sync(){
    syncGreeting();
    if(!admin())return;
    mount();
    set(q('#adm18Greeting'),greeting());
    set(q('#adm18Name'),q('#sidebarName')?.textContent?.trim()||'Administrador');
    set(q('#adm18Date'),now());
    const cash=text('#homeCashAvailable'),loan=text('#homeLoanNegative').replace(/^[-−]\s*/,''),income=text('#homePaidTotal');
    const requests=num('#homePendingRequests'),receipts=num('#homePendingReceipts'),pending=requests+receipts;
    set(q('#adm18Cash'),cash);set(q('#adm18Loan'),loan);set(q('#adm18Income'),income);set(q('#adm18Pending'),pending);
    set(q('#adm18PendingText'),pending?pending+' item(ns) para resolver':'Nenhuma ação pendente');
    set(q('#adm18Requests'),requests);set(q('#adm18Receipts'),receipts);
    const vals=[text('#chartIncomeLabel'),text('#chartExpenseLabel'),text('#chartLoanLabel'),text('#chartCashLabel'),text('#homeLoanInterestGenerated')];
    const nums=vals.map(cashVal),mx=Math.max(...nums,1);
    vals.forEach((v,i)=>{set(q('#adm18v'+i),v);const b=q('#adm18b'+i);if(b)b.style.height=Math.max(8,Math.round(nums[i]/mx*100))+'%'});
  }
  new MutationObserver(sync).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(sync,30000);
  setTimeout(sync,250);
})();
