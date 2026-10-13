
(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const moneyText=id=>$(id)?.textContent?.trim()||'R$ 0,00';
  const numberText=id=>Number(String($(id)?.textContent||'0').replace(/[^0-9-]/g,''))||0;
  const moneyValue=text=>{
    const cleaned=String(text||'0').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');
    return Math.abs(Number(cleaned)||0);
  };
  const escapeHtml=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hourGreeting=()=>{
    const h=new Date().getHours();
    return h<12?'Olá, bom dia':h<18?'Olá, boa tarde':'Olá, boa noite';
  };
  const formatNow=()=>{
    const d=new Date();
    return d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})+' • '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  };
  function isAdminSession(){
    return !!document.querySelector('#appView.is-admin') || !!document.querySelector('.app-shell.is-admin');
  }
  function go(page){
    const nav=document.querySelector('[data-page="'+page+'"]');
    if(nav) nav.click();
  }
  function openAdm(){
    const fab=$('#adminAgentFab');
    const panel=$('#adminAgentPanel');
    if(panel&&fab){panel.classList.remove('hidden');}
    else if(fab) fab.click();
  }

  function build(){
    const dashboard=$('#dashboard');
    if(!dashboard || $('#adminPremiumHome')) return;
    const shell=document.createElement('section');
    shell.id='adminPremiumHome';
    shell.className='admin-premium-home admin-only';
    shell.innerHTML=`
      <div class="adm-premium-header">
        <div class="adm-brand-row">
          <img class="adm-logo" src="/assets/oliver-logo.svg" alt="OLIVER">
          <div class="adm-brand-copy">
            <h1>OLIVER <span>Administração</span></h1>
            <p>Painel administrativo financeiro</p>
          </div>
        </div>
        <div class="adm-header-side">
          <span class="adm-role-pill">♛ Administrador</span>
          <span id="admLiveTime" class="adm-live-time"></span>
        </div>
      </div>

      <div class="adm-welcome">
        <div>
          <small id="admGreeting">Olá</small>
          <h2 id="admName">Administrador</h2>
          <p>Visão geral da OLIVER Caixinha e do que precisa da sua atenção.</p>
        </div>
        <div class="adm-welcome-date"><span>▣</span><b id="admDate"></b></div>
      </div>

      <div class="adm-metrics">
        <button class="adm-metric cash" data-adm-go="admin">
          <span class="adm-icon">◉</span><span>Caixa disponível</span><strong id="admCash">R$ 0,00</strong><small>Saldo atual disponível</small>
        </button>
        <button class="adm-metric" data-adm-go="loans">
          <span class="adm-icon">↗</span><span>Total emprestado</span><strong id="admLoan">R$ 0,00</strong><small>Capital em contratos ativos</small>
        </button>
        <button class="adm-metric" data-adm-go="payments">
          <span class="adm-icon">↑</span><span>Entradas confirmadas</span><strong id="admIncome">R$ 0,00</strong><small>Cotas, rifas, passeios e recebimentos</small>
        </button>
        <button class="adm-metric pending" data-adm-go="admin">
          <span class="adm-icon">!</span><span>Pendências</span><strong id="admPending">0</strong><small id="admPendingText">Nenhuma ação pendente</small>
        </button>
      </div>

      <section class="adm-section">
        <div class="adm-section-head">
          <div><h3>▥ Visão financeira</h3><p>Leitura rápida dos principais números da caixinha.</p></div>
          <button type="button" data-adm-go="admin">Detalhes</button>
        </div>
        <div class="adm-chart-wrap">
          <div class="adm-chart" id="admChart">
            ${['Entradas','Saídas','Emprestado','Caixa','Juros'].map((label,i)=>`
              <div class="adm-chart-item">
                <div class="adm-chart-value" id="admChartValue${i}">R$ 0,00</div>
                <div class="adm-chart-barbox"><div class="adm-chart-bar" id="admChartBar${i}" style="height:12%"></div></div>
                <div class="adm-chart-label">${label}</div>
              </div>`).join('')}
          </div>
        </div>
      </section>

      <section class="adm-section">
        <div class="adm-section-head">
          <div><h3>⚠ Atenção agora</h3><p>O que pode exigir uma decisão ou conferência administrativa.</p></div>
          <button type="button" data-adm-go="admin">Ver central</button>
        </div>
        <div class="adm-attention-grid">
          <button class="adm-attention-card" data-adm-go="payments">
            <span class="top"><span class="ico">▤</span><span id="admReceiptCount" class="adm-count">0</span></span>
            <b>Comprovantes</b><small>Aguardando validação</small>
          </button>
          <button class="adm-attention-card" data-adm-go="admin">
            <span class="top"><span class="ico">↗</span><span id="admRequestCount" class="adm-count">0</span></span>
            <b>Empréstimos aguardando</b><small>Análise e aprovação</small>
          </button>
          <button class="adm-attention-card" data-adm-go="members">
            <span class="top"><span class="ico">◎</span><span class="adm-count neutral">↻</span></span>
            <b>Cadastro dos cotistas</b><small>Acompanhar acessos e atualização de dados</small>
          </button>
          <button class="adm-attention-card" data-adm-go="payments">
            <span class="top"><span class="ico">▣</span><span class="adm-count neutral">Mês</span></span>
            <b>Cotas e vencimentos</b><small>Conferir pagamentos do período</small>
          </button>
        </div>
      </section>

      <section class="adm-section">
        <div class="adm-section-head"><div><h3>⚡ Ações rápidas</h3><p>Acesso direto às funções que já existem no sistema.</p></div></div>
        <div class="adm-actions-grid">
          <button class="adm-action" data-adm-go="members"><span><i>◎</i>Cotistas</span><b>›</b></button>
          <button class="adm-action" data-adm-go="payments"><span><i>▤</i>Comprovantes</span><b>›</b></button>
          <button class="adm-action" data-adm-go="loans"><span><i>↗</i>Empréstimos</span><b>›</b></button>
          <button class="adm-action" data-adm-go="activities"><span><i>★</i>Rifas e passeios</span><b>›</b></button>
          <button class="adm-action" data-adm-go="admin"><span><i>▥</i>Rendimentos</span><b>›</b></button>
          <button class="adm-action" data-adm-go="admin"><span><i>▣</i>Relatórios e controles</span><b>›</b></button>
        </div>
      </section>

      <section class="adm-assistant-card">
        <div class="adm-assistant-orb">🤖</div>
        <div><h3>Oliver ADM</h3><p>Seu assistente operacional para consultas e ações administrativas com confirmação.</p></div>
        <button id="admOpenAssistant" type="button">Conversar agora ›</button>
      </section>

      <nav class="adm-mobile-nav" aria-label="Navegação administrativa">
        <button class="active" data-adm-go="dashboard"><i>⌂</i>Início</button>
        <button data-adm-go="members"><i>◎</i>Cotistas</button>
        <button data-adm-go="loans"><i>↗</i>Empréstimos</button>
        <button data-adm-go="admin"><i>▥</i>Relatórios</button>
        <button data-adm-go="admin"><i>•••</i>Mais</button>
      </nav>
    `;
    dashboard.prepend(shell);

    shell.addEventListener('click',e=>{
      const btn=e.target.closest('[data-adm-go]');
      if(btn) go(btn.dataset.admGo);
    });
    $('#admOpenAssistant')?.addEventListener('click',openAdm);
  }

  function sync(){
    if(!isAdminSession()) return;
    build();
    const name=$('#sidebarName')?.textContent?.trim()||'Administrador';
    const greeting=hourGreeting();
    if($('#admGreeting')) $('#admGreeting').textContent=greeting;
    if($('#admName')) $('#admName').textContent=name;
    if($('#admDate')) $('#admDate').textContent=formatNow();
    if($('#admLiveTime')) $('#admLiveTime').textContent='Atualizado • '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

    const cash=moneyText('#homeCashAvailable');
    const loan=moneyText('#homeLoanNegative');
    const income=moneyText('#homePaidTotal');
    const requests=numberText('#homePendingRequests');
    const receipts=numberText('#homePendingReceipts');
    const pending=requests+receipts;
    if($('#admCash')) $('#admCash').textContent=cash;
    if($('#admLoan')) $('#admLoan').textContent=loan.replace(/^[-−]\s*/,'');
    if($('#admIncome')) $('#admIncome').textContent=income;
    if($('#admPending')) $('#admPending').textContent=String(pending);
    if($('#admPendingText')) $('#admPendingText').textContent=pending?pending+' item(ns) para resolver':'Nenhuma ação pendente';
    if($('#admReceiptCount')) $('#admReceiptCount').textContent=String(receipts);
    if($('#admRequestCount')) $('#admRequestCount').textContent=String(requests);

    const chartTexts=[
      moneyText('#chartIncomeLabel')||income,
      moneyText('#chartExpenseLabel'),
      moneyText('#chartLoanLabel')||loan,
      moneyText('#chartCashLabel')||cash,
      moneyText('#homeLoanInterestGenerated')
    ];
    const values=chartTexts.map(moneyValue);
    const max=Math.max(...values,1);
    values.forEach((v,i)=>{
      const val=$('#admChartValue'+i),bar=$('#admChartBar'+i);
      if(val) val.textContent=chartTexts[i]||'R$ 0,00';
      if(bar) bar.style.height=Math.max(8,Math.round(v/max*100))+'%';
    });

    // Saudação dinâmica também na área do cotista, sem alterar o restante do layout.
    const hg=$('#homeGreeting');
    if(hg) hg.textContent=greeting.replace(/^Olá,\s*/,'');
  }

  const observer=new MutationObserver(()=>sync());
  observer.observe(document.body,{subtree:true,attributes:true,childList:true,characterData:true});
  setInterval(sync,30000);
  setTimeout(sync,250);
})();
