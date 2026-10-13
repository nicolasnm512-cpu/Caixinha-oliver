
(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const all=(s,r=document)=>[...r.querySelectorAll(s)];
  const text=(sel)=>$(sel)?.textContent?.trim()||'R$ 0,00';
  const num=(sel)=>Number(String($(sel)?.textContent||'0').replace(/[^0-9-]/g,''))||0;
  const money=(v)=>Math.abs(Number(String(v||'0').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.'))||0);
  const greeting=()=>{const h=new Date().getHours();return h<12?'Olá, bom dia':h<18?'Olá, boa tarde':'Olá, boa noite'};
  const now=()=>new Date().toLocaleString('pt-BR',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  const isAdmin=()=>$('#appView')?.classList.contains('is-admin');
  const set=(el,v)=>{if(el&&el.textContent!==String(v))el.textContent=String(v)};
  const go=(page)=>{
    const btn=document.querySelector('#mainNav [data-page="'+page+'"]')||document.querySelector('[data-page="'+page+'"]');
    if(btn) btn.click();
  };

  function syncGreeting(){
    const g=greeting();
    const home=$('#homeGreeting');
    if(home)set(home,g);
    set($('#adm18Greeting'),g);
  }

  function syncNav(){
    const active=document.querySelector('.page.active-page')?.id||'dashboard';
    all('#adm18GlobalNav [data-adm18-go]').forEach(b=>b.classList.toggle('active',b.dataset.adm18Go===active));
  }

  function sync(){
    syncGreeting();
    if(!isAdmin())return;

    set($('#adm18Name'),$('#sidebarName')?.textContent?.trim()||'Administrador');
    set($('#adm18Date'),now());

    const cash=text('#homeCashAvailable');
    const loan=text('#homeLoanNegative').replace(/^[-−]\s*/,'');
    const income=text('#homePaidTotal');
    const requests=num('#homePendingRequests');
    const receipts=num('#homePendingReceipts');
    const pending=requests+receipts;

    set($('#adm18Cash'),cash);
    set($('#adm18Loan'),loan);
    set($('#adm18Income'),income);
    set($('#adm18Pending'),pending);
    set($('#adm18PendingText'),pending?pending+' item(ns) para resolver':'Nenhuma ação pendente');
    set($('#adm18Requests'),requests);
    set($('#adm18Receipts'),receipts);

    const vals=[
      text('#chartIncomeLabel'),
      text('#chartExpenseLabel'),
      text('#chartLoanLabel'),
      text('#chartCashLabel'),
      text('#homeLoanInterestGenerated')
    ];
    const nums=vals.map(money),mx=Math.max(...nums,1);
    vals.forEach((v,i)=>{
      set($('#adm18v'+i),v);
      const bar=$('#adm18b'+i);
      if(bar)bar.style.height=Math.max(8,Math.round(nums[i]/mx*100))+'%';
    });
    syncNav();
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-adm18-go]');
    if(b){e.preventDefault();go(b.dataset.adm18Go);setTimeout(syncNav,40)}
  });

  $('#adm18OpenAi')?.addEventListener('click',()=>$('#adminAgentPanel')?.classList.remove('hidden'));

  new MutationObserver(sync).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(sync,30000);
  setTimeout(sync,150);
})();
