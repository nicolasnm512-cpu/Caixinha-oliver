/* OLIVER • Comportamento exclusivamente visual do menu lateral PET HOME. */
(function(){
  'use strict';
  const shell=document.getElementById('appView');
  const toggle=document.getElementById('oliverSidebarToggle');
  if(!shell||!toggle)return;
  const key='oliver:pethome-sidebar-collapsed:v1';
  function apply(collapsed){
    shell.classList.toggle('pethome-sidebar-collapsed',collapsed);
    toggle.textContent=collapsed?'»':'«';
    toggle.title=collapsed?'Expandir menu lateral':'Recolher menu lateral';
    toggle.setAttribute('aria-label',toggle.title);
    toggle.setAttribute('aria-pressed',String(collapsed));
  }
  let collapsed=false;
  try{collapsed=window.localStorage.getItem(key)==='1'}catch(_){}
  apply(collapsed);
  toggle.addEventListener('click',function(){
    collapsed=!shell.classList.contains('pethome-sidebar-collapsed');
    apply(collapsed);
    try{window.localStorage.setItem(key,collapsed?'1':'0')}catch(_){}
  });
  // Mantém os ícones acessíveis ao recolher o menu.
  for(const item of shell.querySelectorAll('.sidebar nav .nav-item')){
    const title=(item.getAttribute('data-admin-label')||item.getAttribute('data-member-label')
      ||item.textContent||'Menu').trim();
    if(!item.hasAttribute('title'))item.setAttribute('title',title);
  }
})();
