// RANKING INDIVIDUAL CPZ 2026/27 — panel de administración.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clean = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim().replace(/\s+/g, ' ');
  const H = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let accounts = [], results = [], doubleResults = [], community = {channels:[], videos:[]}, staged = [], stagedIssues = [], stagedName = '', issued = null;
  let currentView = 'home';

  async function api(path, payload) {
    const opts = {credentials:'same-origin', cache:'no-store'};
    if (payload) {opts.method='POST';opts.headers={'Content-Type':'application/json'};opts.body=JSON.stringify(payload);}
    const response = await fetch(path, opts);
    let data={};try {data=await response.json();} catch(_){}
    if(!response.ok || data.ok===false) {
      const err=new Error(data.error || 'No se ha podido completar la solicitud.');
      err.details=data.details || [];
      throw err;
    }
    return data;
  }
  const motionReduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const metricStates=new WeakMap();
  let toastTimer=0;
  let toastElement=null;
  function showToast(message){
    if(!toastElement){
      toastElement=document.createElement('div');
      toastElement.className='fx-toast';
      toastElement.setAttribute('aria-hidden','true'); // The status field already announces updates.
      document.body.append(toastElement);
    }
    clearTimeout(toastTimer);
    toastElement.textContent='✓  '+message;
    toastElement.classList.remove('fx-toast-visible');
    void toastElement.offsetWidth; // Replay entrance when confirming successive operations.
    toastElement.classList.add('fx-toast-visible');
    toastTimer=setTimeout(()=>toastElement.classList.remove('fx-toast-visible'),3200);
  }
  function say(id,text){
    $(id).textContent=text||'';
    if(/^(Cambios guardados|Foto e Instagram guardados|Plaza Jugador X creada|Información legal publicada|Datos copiados)/.test(text||'')){
      showToast('Cambios guardados correctamente');
    }
  }
  function animateMetric(id,value){
    const element=$(id),target=Math.max(0,Number(value)||0);
    const prev=metricStates.get(element);
    if(prev?.target===target)return;
    if(prev?.frame)cancelAnimationFrame(prev.frame);
    const start=Number(element.textContent)||0;
    if(motionReduced.matches||start===target){
      element.textContent=String(target);
      metricStates.set(element,{target,frame:0});
      return;
    }
    const duration=570,begin=performance.now(),state={target,frame:0};
    metricStates.set(element,state);
    function tick(now){
      const t=Math.min(1,Math.max(0,(now-begin)/duration));
      const ease=1-Math.pow(1-t,3);
      element.textContent=String(Math.round(start+(target-start)*ease));
      if(t<1)state.frame=requestAnimationFrame(tick);
      else state.frame=0;
    }
    state.frame=requestAnimationFrame(tick);
  }
  function updateOperations(){
    const host=$('operationsDashboard');if(!host)return;
    const november=results.filter(r=>String(r.date||'').startsWith('2026-11'));
    const metrics=[['Grupos individuales','10'],['Jugadores en el listado','40'],['Resultados noviembre',november.length+' / 60'],['Partidos pendientes',Math.max(0,60-november.length)]];
    host.replaceChildren();
    for(const [label,value] of metrics){const item=document.createElement('div');item.className='metric';const number=document.createElement('b');number.textContent=value;const caption=document.createElement('small');caption.textContent=label;item.append(number,caption);host.append(item)}
    const warning=$('operationsWarning');if(warning)warning.textContent='Los partidos se pueden introducir directamente desde el listado oficial. No es necesario crear cuentas personales.';
  }
  function renderSeasonHistory(){
    const host=$('seasonHistory');if(!host)return;
    host.replaceChildren();
    const months=new Map();
    for(const r of results){const period=String(r.date||'').slice(0,7);if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(period))continue;
      const record=months.get(period)||{total:0,groups:new Set()};record.total++;if(r.groupLabel)record.groups.add(r.groupLabel);months.set(period,record)}
    const keys=[...months.keys()].sort().reverse();
    if(!keys.length){host.textContent='Todavía no hay resultados registrados para construir el histórico mensual.';return}
    for(const key of keys){const row=document.createElement('article');row.className='player-card';row.style.marginBottom='10px';
      const title=document.createElement('strong');title.textContent=key;
      const meta=document.createElement('p');meta.textContent=months.get(key).total+' resultados registrados · '+months.get(key).groups.size+' grupos con resultados';
      row.append(title,meta);host.append(row)}
  }
  function stats(){
    animateMetric('playerCount',40);
    animateMetric('activeCount',18);
    animateMetric('pairedCount',accounts.filter(x=>x.opponentName).length);
    animateMetric('resultCount',results.length);
    $('resultLabel').textContent=results.length+' partidos guardados';
  }
  // Brillo que sigue al cursor en tarjetas, solo en dispositivos de ratón.
  if(window.matchMedia('(hover: hover) and (pointer: fine)').matches&&!motionReduced.matches){
    let pending=null,frame=0;
    document.addEventListener('pointermove',event=>{
      const element=event.target instanceof Element?event.target.closest('.metric,.card,.player-card'):null;
      if(!element)return;
      pending={element,x:event.clientX,y:event.clientY};
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;
        if(!pending)return;
        const {element,x,y}=pending;
        const box=element.getBoundingClientRect();
        element.style.setProperty('--fx-x',(x-box.left)+'px');
        element.style.setProperty('--fx-y',(y-box.top)+'px');
        pending=null;
      });
    },{passive:true});
  }
  document.addEventListener('pointerdown',event=>{
    if(motionReduced.matches||event.button!==0||!(event.target instanceof Element))return;
    const button=event.target.closest('.button,.nav');
    if(!button||button.disabled)return;
    const box=button.getBoundingClientRect();
    const ripple=document.createElement('span');
    ripple.className='fx-ripple';
    ripple.style.setProperty('--ripple-x',(event.clientX-box.left)+'px');
    ripple.style.setProperty('--ripple-y',(event.clientY-box.top)+'px');
    button.append(ripple);
    ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
    setTimeout(()=>ripple.remove(),800);
  },{passive:true});
  // Barra de progreso calculada sobre la altura real, sin seguimiento externo.
  function setupReadingProgress(){
    let scheduled=false;
    function update(){
      scheduled=false;
      const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
      const progress=max>0?Math.max(0,Math.min(1,window.scrollY/max)):0;
      document.documentElement.style.setProperty('--cpz-read-progress',String(progress));
    }
    function schedule(){
      if(scheduled)return;
      scheduled=true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    schedule();
    return schedule;
  }
  const updateReadingProgress=setupReadingProgress();
  function show(name) {
    const changed=currentView!==name;
    currentView=name;
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='page-'+name);
    if(name==='players'||name==='groups')loadPlayers();
    if(name==='doubles')loadDoubleResults();
    if(name==='results')loadResults();
    if(name==='groups')loadResults();
    if(name==='home'){loadPlayers();loadResults();}
    if(name==='videos')loadVideos();
    if(name==='legal'){loadLegalSettings();loadConsentAudit()}
    updateReadingProgress();
    if(changed&&window.scrollY>180)window.scrollTo({top:0,behavior:motionReduced.matches?'auto':'smooth'});
  }
  document.querySelectorAll('[data-view],[data-target]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view||b.dataset.target)));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  $('logout').onclick=async()=>{try{await api('/api/logout',{})}catch(e){}location.replace('/')};
  const randPass=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const makeUser=name=>clean(name).replace(/\s/g,'.').replace(/[^a-z0-9._-]/g,'').slice(0,32);
  $('generatePass').onclick=()=>$('playerForm').elements.password.value=randPass();
  $('playerForm').elements.playerName.addEventListener('input', e=>{
    const form=e.target.form;
    if(!form.elements.username.dataset.edited)form.elements.username.value=makeUser(e.target.value);
  });
  $('playerForm').elements.username.addEventListener('input', e=>e.target.dataset.edited='1');
  function issue(name, username, password) {
    issued={name,username,password};
    $('issuedName').textContent=name;
    $('issuedUser').textContent='Usuario: '+username;
    $('issuedPass').textContent='Contraseña: '+password;
    $('issuedBox').hidden=false;
  }
  $('hideIssued').onclick=()=>{issued=null;$('issuedPass').textContent='';$('issuedBox').hidden=true};
  $('copyIssued').onclick=async()=>{
    if(!issued)return;
    const text='RANKING INDIVIDUAL CPZ 2026/27\nAcceso directo de jugador: https://leagueos-cpz.pages.dev/?role=player\nElige «Soy jugador», NO «Administrador».\nJugador: '+issued.name+'\nNombre de usuario: '+issued.username+'\nContraseña provisional: '+issued.password+'\nPuedes cambiarla desde Mi cuenta.';
    try{await navigator.clipboard.writeText(text);say('playerStatus','Datos copiados. Entrégalos solamente al jugador.')}
    catch(e){say('playerStatus','Copia manualmente las credenciales mostradas.')}
  };
  function b(label,style,click){
    const el=document.createElement('button');
    el.type='button';el.className='button '+(style||'secondary');el.textContent=label;el.onclick=click;return el;
  }
  async function updatePlayer(action,payload,id='playerStatus'){
    say(id,'Guardando…');
    try{
      const d=await api('/api/accounts',{action,...payload});
      accounts=d.accounts||[];renderPlayers();renderGroups();updateOperations();manualFixtures();stats();say(id,'Cambios guardados.');return true;
    }catch(e){say(id,e.message);return false}
  }
  async function loadPlayers(){
    try{
      const data=await api('/api/accounts');accounts=data.accounts||[];renderPlayers();renderGroups();updateOperations();manualFixtures();stats();say('playerStatus','');
    }catch(e){say('playerStatus',e.message);$('playerCards').innerHTML='<div class="empty">No se han podido cargar los jugadores.</div>'}
  }
  $('refreshPlayers').onclick=loadPlayers;
  $('playerSearch').oninput=renderPlayers;
  $('playerForm').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget, f=form.elements;
    const name=f.playerName.value.trim(),username=f.username.value.trim().toLowerCase(),password=f.password.value;
    const ok=await updatePlayer('create',{
      playerName:name,username,password,email:f.email.value,whatsappPhone:f.whatsappPhone.value,
      shareWithOpponent:f.shareWithOpponent.checked,groupLabel:f.groupLabel.value,
      privacyInformed:f.privacyInformed.checked
    });
    if(ok){issue(name,username,password);form.reset();f.username.dataset.edited='';}
  };
  $('createPlaceholder').onclick=async()=>{
    if(!confirm('¿Crear una plaza de competición sin nombre, teléfono, correo ni cuenta de acceso? Se mostrará como Jugador X.'))return;
    $('createPlaceholder').disabled=true;say('placeholderStatus','Creando plaza privada…');
    try{
      const d=await api('/api/accounts',{action:'createPlaceholder'});
      accounts=d.accounts||[];renderPlayers();stats();
      say('placeholderStatus','Plaza Jugador X creada. Puedes asignarle rivales e importar resultados con su código interno.');
    }catch(e){say('placeholderStatus',e.message)}
    finally{$('createPlaceholder').disabled=false}
  };

  // Grupos privados: usar solo las cuentas autorizadas presentes en D1.
  const NOVEMBER_ROSTER={"A1":["Chema Balmori","Pedro Hernández","Javier Gimeno","Carlos Guillén"],"A2":["Jaime Mengual","Mario Pintanel","Eduardo Alvira","Ignacio Algas"],"A3":["Álvaro Esteban","Marcos Domeque","Javier Royo","Óscar Pinilla"],"A4":["Felipe Echevarría","Juan Jiménez","Alejandro Mendívil","Ramón Ruiz de Conejo"],"A5":["Jorge Ramón García","Mariano Guillén","Jorge Corbas","Pablo Oliván"],"B1":["Emilio Martín","Diego Cuervo","Carlos Lama","Enzo Navarro"],"B2":["Roberto Moreno","David Calavia","David Martos","Álex Aznar"],"B3":["David Serrate","Manuel Ángel Berges","Dani Sevil","Raúl García"],"B4":["Carlos Vilar","Gabriel Tena","Marco Antonio Lamata","Alejandro Embid"],"B5":["Gabriel Aguilar","Orlando Aguilar","Irene Martínez","Antonio Estopañán"]};
  const NOVEMBER_GROUPS=Object.keys(NOVEMBER_ROSTER);
  function explainRank(p,position,complete){
    if(!p.pj)return p.name+' está en la posición '+position+' porque todavía no se han registrado partidos. El orden es el del listado inicial y NO representa resultados deportivos.';
    let reason='La clasificación se ordena primero por número de victorias.';
    if(p.criterion.includes('directo ganado'))reason='Ha quedado por delante de otro participante con las mismas victorias porque ganó el partido que jugaron entre sí.';
    else if(p.criterion.includes('directo perdido'))reason='Ha quedado por detrás de otro participante con las mismas victorias porque perdió el enfrentamiento directo.';
    else if(p.criterion.includes('triple')||p.criterion.includes('entre 3'))reason='Hay tres participantes empatados en victorias. Se han comparado exclusivamente sus enfrentamientos mutuos, primero por diferencia de sets, después por diferencia de puntos y finalmente por puntos a favor. Criterio aplicado: '+p.criterion+'.';
    else if(p.unresolved)reason='El desempate todavía no puede resolverse según las normas disponibles. Motivo: '+p.criterion+'. La posición mostrada es provisional.';
    return p.name+' · Posición '+position+'.\n\nHa ganado '+p.pg+' de '+p.pj+' partidos. Su diferencia de sets es '+(p.sf-p.sc)+', su diferencia de puntos es '+(p.pf-p.pc)+' y ha conseguido '+p.pf+' puntos a favor.\n\n'+reason+(!complete?'\n\nLa tabla todavía es provisional: faltan encuentros o confirmar desempates.':'');
  }
  function standingFor(names,records){return CPZRanking.rankCompetition(names,records).rows}
  // Dobles de noviembre: orden de organización facilitado por el club.
  // Sin registros de resultados de dobles: no reutilizar los resultados individuales.
  const NOVEMBER_DOUBLES={"A1":[["Carlos Guillén","Arturo Royo"],["Chema Balmori","Jorge Delgado"],["Mario Pintanel","Pedro Hernández"],["Javier Gimeno","Jaime Mengual"]],"A2":[["Miguel Val","Víctor Otín"],["Mariano Guillén","Jorge Ramón"],["David Martos","Jorge Corbas"],["Carlos Anés","Jaime Alloza"]],"B1":[["Ana Daroca","Javier Negrete"],["Ramón Ruiz de Conejo","Ramón Ruiz de Conejo"],["Enzo Navarro","Francisco Navarro"],["Judit Campos","Marta Ríos"]],"B2":[["Hugo Urbina","Pablo Oliván"],["Dani Sevil","Carlos Lama"],["Raúl Berges","Carlos Vilar"],["Andrea Ruiz","Mario Ruiz"]],"B3":[["Víctor Enguita","Roberto Moreno"],["Emilio Martín","Miguel Ángel Lázaro"],["Elías Tena","Luis Gracia"],["Carlos Bescós","Francisco Bescós"]],"B4":[["Orlando Aguilar","Sergio Lahoz"],["Alejandro Embid","Samuel James"],["Marco Antonio Lamata","Gabriel Tena"],["Julia Guerrero","Raquel Cisneros"]],"C1":[["Begoña Agüeras","Ángel Monzón"],["Silvia García","Carmen Morales"],["Belén Trol","Gema Orecilla"]],"C2":[["Gloria Villas","Omar El Kadmiri"],["Javier Palacio","Guillermo Lacasa"],["Ramón Ruiz de Conejo","Silvia Gracia"]]};
  const DOUBLE_GROUPS=Object.keys(NOVEMBER_DOUBLES);

  function activeDoublesGroup(){return $('doublesCategory').value+$('doublesGroup').value}
  function pairLabel(group,index){return (NOVEMBER_DOUBLES[group]?.[index]||['Pareja','no disponible']).join(' / ')}
  function doubleRecords(group){
    return doubleResults.filter(r=>r.groupLabel===group).map(r=>({
      player1:pairLabel(group,r.pair1),player2:pairLabel(group,r.pair2),sets:r.sets
    }));
  }
  function doubleFixtureOptions(){
    const group=activeDoublesGroup(),pairs=NOVEMBER_DOUBLES[group]||[],select=$('doubleFixture'),prior=select.value;
    select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Elegir enfrentamiento';select.append(blank);
    for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){
      const opt=document.createElement('option');opt.value=i+'|'+j;
      const existing=doubleResults.some(r=>r.groupLabel===group&&r.pair1===i&&r.pair2===j);
      opt.textContent=pairLabel(group,i)+' contra '+pairLabel(group,j)+(existing?' · Ya registrado':'');
      select.append(opt);
    }
    if([...select.options].some(o=>o.value===prior))select.value=prior;
  }
  function renderDoubleHistory(){
    const root=$('doubleResultHistory');if(!root)return;root.replaceChildren();
    if(!doubleResults.length){root.textContent='Aún no hay resultados de dobles registrados.';return}
    const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody');
    head.innerHTML='<tr><th>Fecha</th><th>Grupo</th><th>Parejas</th><th>Sets</th><th>Ganador</th><th>Acción</th></tr>';
    for(const r of doubleResults){
      const tr=document.createElement('tr');
      const vals=[r.date,r.groupLabel,pairLabel(r.groupLabel,r.pair1)+' contra '+pairLabel(r.groupLabel,r.pair2),r.sets.map(x=>x.join('-')).join(' · '),pairLabel(r.groupLabel,r.winnerPair)];
      for(const value of vals){const td=document.createElement('td');td.textContent=String(value);tr.append(td)}
      const cell=document.createElement('td');
      cell.append(b('Editar','secondary',()=>editDouble(r)),b('Eliminar','warning',async()=>{
        if(!confirm('¿Eliminar este resultado de dobles?'))return;
        try{const data=await api('/api/doubles-results',{action:'delete',id:r.id});
          doubleResults=data.results||[];renderDoubles();renderDoubleHistory();say('doubleStatus','Resultado eliminado.')}
        catch(error){say('doubleStatus',error.message)}
      }));tr.append(cell);body.append(tr);
    }
    table.append(head,body);root.append(table);
  }
  function renderDoubles(){
    const category=$('doublesCategory'),select=$('doublesGroup'),root=$('doublesCards');
    if(!category||!select||!root)return;
    const labels=DOUBLE_GROUPS.filter(g=>g.startsWith(category.value)),previous=select.value;
    select.replaceChildren();
    for(const label of labels){const opt=document.createElement('option');opt.value=label.slice(1);opt.textContent='Grupo '+label.slice(1);select.append(opt)}
    select.value=labels.some(g=>g===category.value+previous)?previous:'1';
    const group=activeDoublesGroup(),pairs=NOVEMBER_DOUBLES[group]||[],count=pairs.length,games=count*(count-1)/2;
    const info=CPZRanking.rankCompetition(pairs.map(x=>x.join(' / ')),doubleRecords(group));
    $('doublesSelectionHint').textContent='Mostrando '+group+' · '+count+' parejas · '+info.played+' de '+games+' partidos registrados';
    root.replaceChildren();
    const card=document.createElement('article');card.className='group-card';
    const title=document.createElement('h3');title.className='cpz-group-heading';title.textContent='GRUPO '+group+' · CLASIFICACIÓN DOBLES';card.append(title);
    const caption=document.createElement('p');caption.className='cpz-doubles-caption';caption.textContent=count+' parejas · '+(count-1)+' partidos por pareja · '+info.played+' de '+games+' resultados';card.append(caption);
    const wrap=document.createElement('div');wrap.className='cpz-standings-wrap';
    const table=document.createElement('table');table.className='cpz-standings';
    const head=document.createElement('thead');head.innerHTML='<tr><th>Pos.</th><th>Pareja</th><th>Estado</th><th>PJ</th><th>PG</th><th>PP</th><th>Sets F/C</th><th>Dif. sets</th><th>Puntos F/C</th><th>Dif. puntos</th><th>PTS*</th></tr>';table.append(head);
    const body=document.createElement('tbody');
    info.rows.forEach((p,i)=>{
      const tr=document.createElement('tr'),up=i===0&&group!=='A1',down=i===count-1&&group!=='C2';
      if(up)tr.classList.add('cpz-rise');if(down)tr.classList.add('cpz-drop');
      const pos=document.createElement('td');pos.className='cpz-pos';pos.textContent=String(i+1);tr.append(pos);
      const team=document.createElement('td'),name=document.createElement('span');name.className='cpz-double-pair';name.textContent=p.name;team.append(name);
      const help=document.createElement('button');help.type='button';help.className='cpz-criteria-info';help.textContent='ⓘ';help.setAttribute('aria-label','Explicar la posición de '+p.name);
      help.addEventListener('click',()=>alert(explainRank(p,i+1,info.complete)));
      team.append(help);tr.append(team);
      const status=document.createElement('td');
      if(up||down){const flag=document.createElement('span');flag.className='cpz-movement '+(up?'up':'down');flag.textContent=up?'▲ ASCENSO':'▼ DESCENSO';status.append(flag)}
      else status.textContent='—';
      tr.append(status);
      for(const v of [p.pj,p.pg,p.pp,p.sf+' / '+p.sc,p.sf-p.sc,p.pf+' / '+p.pc,p.pf-p.pc,p.pts]){
        const td=document.createElement('td');td.textContent=String(v);tr.append(td)}
      body.append(tr);
    });table.append(body);wrap.append(table);card.append(wrap);
    const desc=document.createElement('p');desc.className='cpz-standings-note';
    desc.textContent=info.complete?'Todos los enfrentamientos registrados. Desempates según las normas proporcionadas; revisión final por organización.':info.played?'Clasificación provisional: no todos los partidos están registrados. El color indica zona de movimiento, no ascenso o descenso confirmado.':'Orden inicial para organizar cruces; todavía no hay resultados. Las posiciones no son clasificación oficial.';card.append(desc);
    if(info.warnings.length){const warn=document.createElement('p');warn.className='cpz-ranking-warning';warn.textContent='Empates pendientes: '+info.warnings.join(' · ');card.append(warn)}
    const expl=document.createElement('p');expl.className='cpz-ranking-explainer';expl.textContent='Orden oficial: victorias → enfrentamiento directo (2 empatados) → diferencia de sets → diferencia de puntos → puntos a favor. Si empatan 3, se calculan esos tres últimos criterios solo entre ellos. Pulsa ⓘ para consultar el motivo.';card.append(expl);
    const fixtures=document.createElement('div');fixtures.className='cpz-fixtures';
    const fh=document.createElement('h4');fh.textContent='Enfrentamientos · '+games;fixtures.append(fh);
    const list=document.createElement('div');list.className='cpz-fixture-list';let number=0;
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
      number++;const done=doubleResults.find(r=>r.groupLabel===group&&r.pair1===i&&r.pair2===j);
      const item=document.createElement('div');item.className='cpz-fixture';
      const label=document.createElement('strong');label.textContent='PARTIDO '+number+(done?' · RESULTADO '+done.sets.map(s=>s.join('-')).join(' / '):' · PENDIENTE');
      const names=document.createElement('span');names.textContent=pairLabel(group,i)+' contra '+pairLabel(group,j);
      item.append(label,names);list.append(item);
    }
    fixtures.append(list);card.append(fixtures);root.append(card);
    doubleFixtureOptions();
  }
  let editingDoubleId=null;
  function resetDouble(){
    editingDoubleId=null;$('doubleResultForm').reset();$('doubleRound').value='Noviembre 2026';
    $('doubleDate').value=new Date().toISOString().slice(0,10);
    $('doubleSave').textContent='Guardar resultado';doubleFixtureOptions();say('doubleStatus','');
  }
  function editDouble(r){
    editingDoubleId=r.id;$('doublesCategory').value=r.groupLabel[0];$('doublesGroup').value=r.groupLabel.slice(1);renderDoubles();
    $('doubleFixture').value=r.pair1+'|'+r.pair2;$('doubleDate').value=r.date;$('doubleRound').value=r.round;
    for(let i=1;i<=3;i++){const scores=r.sets[i-1]||[];$('doubleS'+i+'a').value=scores.length?String(scores[0]):'';$('doubleS'+i+'b').value=scores.length?String(scores[1]):''}
    $('doubleSave').textContent='Guardar cambios';$('doubleResultForm').scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function loadDoubleResults(){
    try{const data=await api('/api/doubles-results');doubleResults=data.results||[];renderDoubles();renderDoubleHistory();say('doubleStatus','')}
    catch(error){say('doubleStatus',error.message)}
  }
  $('doubleResultForm').addEventListener('submit',async event=>{
    event.preventDefault();const pair=$('doubleFixture').value.split('|').map(Number),group=activeDoublesGroup();
    if(pair.length!==2||!pair.every(Number.isInteger)||pair[0]===pair[1])return say('doubleStatus','Selecciona un enfrentamiento.');
    const sets=[];
    for(let i=1;i<=3;i++){const x=$('doubleS'+i+'a').value,y=$('doubleS'+i+'b').value;
      if(i===3&&x===''&&y==='')continue;
      if(x===''||y==='')return say('doubleStatus','Rellena los dos tanteos de cada set.');
      sets.push([Number(x),Number(y)]);
    }
    $('doubleSave').disabled=true;
    try{const data=await api('/api/doubles-results',{action:'save',id:editingDoubleId,groupLabel:group,pair1:pair[0],pair2:pair[1],date:$('doubleDate').value,round:$('doubleRound').value,sets});
      doubleResults=data.results||[];renderDoubles();renderDoubleHistory();resetDouble();say('doubleStatus','Resultado de dobles guardado. Clasificación recalculada.')}
    catch(error){say('doubleStatus',error.message)}
    finally{$('doubleSave').disabled=false}
  });
  $('doubleClear').addEventListener('click',resetDouble);
  $('doubleRefresh').addEventListener('click',loadDoubleResults);
  $('doublesCategory').addEventListener('change',()=>{editingDoubleId=null;renderDoubles()});
  $('doublesGroup').addEventListener('change',()=>{editingDoubleId=null;renderDoubles()});
  renderDoubles();resetDouble();
  function renderGroups(){
    const root=$('groupCards');if(!root)return;
    root.replaceChildren();let linked=0;
    const selectedCategory=$('rankCategory')?.value||'A',selectedNumber=$('rankGroup')?.value||'1';
    const selectedLabel=selectedCategory+selectedNumber;
    for(const label of NOVEMBER_GROUPS){
      const names=NOVEMBER_ROSTER[label];
      const members=accounts.filter(a=>clean(a.groupLabel||'').replace('grupo ','').replaceAll(' ','')===clean(label));
      linked+=names.filter(n=>members.some(a=>clean(a.playerName)===clean(n))).length;
      const games=results.filter(r=>clean(r.groupLabel||'').replace('grupo ','').replaceAll(' ','')===clean(label) && String(r.date||'').startsWith('2026-11'));
      const info=CPZRanking.rankCompetition(names,games),standings=info.rows;
      const card=document.createElement('article');card.className='group-card';
      const title=document.createElement('h3');title.className='cpz-group-heading';title.textContent='GRUPO '+label+' · CLASIFICACIÓN';card.append(title);
      const note=document.createElement('p');note.textContent=info.played+' de 6 encuentros registrados · noviembre 2026';card.append(note);
      const scroll=document.createElement('div');scroll.className='cpz-standings-wrap';
      const table=document.createElement('table');table.className='cpz-standings';
      const head=document.createElement('thead');head.innerHTML='<tr><th>Clasif.</th><th>Jugador</th><th>Estado</th><th>P.J</th><th>P.G</th><th>P.P</th><th>Set F/C</th><th>Dif. sets</th><th>Puntos F/C</th><th>Diferencia</th><th>Puntos</th></tr>';table.append(head);
      const body=document.createElement('tbody');const played=standings.some(p=>p.pj>0);
      standings.forEach((p,i)=>{
        const tr=document.createElement('tr');const promotion=i===0&&label!=='A1',relegation=i===standings.length-1&&label!=='B5';
        if(promotion)tr.classList.add('cpz-rise');if(relegation)tr.classList.add('cpz-drop');
        const vals=[String(i+1),p.name,null,String(p.pj),String(p.pg),String(p.pp),p.sf+' / '+p.sc,String(p.sf-p.sc),p.pf+' / '+p.pc,String(p.pf-p.pc),String(p.pts)];
        vals.forEach((value,j)=>{const td=document.createElement('td');if(j===0){td.className='cpz-pos';td.textContent=value}
          else if(j===2){if(promotion||relegation){const flag=document.createElement('span');flag.className='cpz-movement '+(promotion?'up':'down');flag.textContent=promotion?'▲ ASCENSO':'▼ DESCENSO';td.append(flag)}else td.textContent='—'}
          else if(j===1){td.textContent=value;
            const help=document.createElement('button');help.type='button';help.className='cpz-criteria-info';help.textContent='ⓘ';help.setAttribute('aria-label','Explicar posición de '+p.name);
            help.addEventListener('click',()=>alert(explainRank(p,i+1,info.complete)));td.append(help);
          }else td.textContent=value;tr.append(td)});
        body.append(tr);
      });table.append(body);scroll.append(table);card.append(scroll);
      const legend=document.createElement('p');legend.className='cpz-standings-note';legend.textContent=info.complete?'Partidos completos. Desempates calculados según las normas, pendientes de validación final por el club.':played?'Clasificación provisional: todavía hay encuentros pendientes. Verde y rojo indican plazas de movimiento, no ascensos decididos.':'Sin resultados: el orden es el listado inicial, no clasificación oficial. Las zonas de color solo identifican plazas de movimiento.';card.append(legend);
      if(info.warnings.length){const warning=document.createElement('p');warning.className='cpz-ranking-warning';warning.textContent='Empates sin resolución definitiva: '+info.warnings.join(' · ');card.append(warning)}
      const explanation=document.createElement('p');explanation.className='cpz-ranking-explainer';explanation.textContent='Criterios oficiales: victorias, enfrentamiento directo entre 2, diferencia de sets, diferencia de puntos y puntos a favor. Empate de 3: miniclasificación de sus enfrentamientos. Pulsa ⓘ para ver el motivo.';card.append(explanation);
      if(label===selectedLabel)root.append(card);
    }
    if($('rankSelectionHint'))$('rankSelectionHint').textContent='Mostrando '+selectedLabel+' · 4 participantes · 6 enfrentamientos';
    $('groupPlayerCount').textContent='40';
    $('groupMatchCount').textContent='60';
  }
  $('rankCategory').addEventListener('change',renderGroups);
  $('rankGroup').addEventListener('change',renderGroups);
  $('refreshGroups').onclick=loadPlayers;
  function renderPlayers(){
    stats();
    const term=clean($('playerSearch').value);
    const list=accounts.filter(a=>clean([a.playerName,a.username,a.email].join(' ')).includes(term));
    if(!list.length){$('playerCards').innerHTML='<div class="empty">'+(term?'No hay coincidencias.':'Todavía no hay jugadores. Da de alta el primer perfil manualmente.')+'</div>';return}
    const frag=document.createDocumentFragment();
    for(const a of list){
      const card=document.createElement('article');card.className='player-card';
      const head=document.createElement('div');head.className='between';
      const identity=document.createElement('div');identity.className='social-player-head';
      if(a.hasPhoto===1){
        const photo=document.createElement('img');photo.className='player-card-photo';
        photo.src='/api/accounts?photo='+encodeURIComponent(a.id);
        photo.alt='Foto privada de '+a.playerName;
        photo.loading='lazy';photo.referrerPolicy='same-origin';identity.append(photo);
      }else{
        const fallback=document.createElement('div');fallback.className='player-card-no-photo';
        fallback.textContent=a.playerName.split(' ').slice(0,2).map(n=>n[0]||'').join('').toUpperCase();identity.append(fallback);
      }
      const title=document.createElement('strong');title.textContent=a.playerName;
      identity.append(title);
      const tag=document.createElement('span');tag.className='tag'+(a.enabled===1?'':' off');tag.textContent=a.enabled===1?'Activa':'Desactivada';
      head.append(identity,tag);
      const meta=document.createElement('p');meta.className='small';
      meta.textContent=a.isPlaceholder===1
        ?'Plaza Jugador X · sin información personal · sin cuenta de acceso'
        :'@'+a.username+' · '+(a.email||'Sin correo')+' · Grupo '+(a.groupLabel||'pendiente')+' · Nombre visible al rival: '+(a.shareName===1?'autorizado':'oculto (Jugador X)');
      const info=document.createElement('p');info.className='small';
      info.textContent='Rival: '+(a.opponentName||'Sin asignar')+' · WhatsApp '+(a.whatsappPhone||'pendiente')+(a.shareWithOpponent===1?' (autorizado)':' (privado)');
      const controls=document.createElement('div');controls.className='actions';
      if(a.isPlaceholder===1){
        controls.append(b('Asignar rival','secondary',()=>openPair(a)),b('Eliminar plaza','warning',()=>removePlayer(a)));
      }else{
        controls.append(
          b('Editar','secondary',()=>openEdit(a)),
          b('Asignar rival','secondary',()=>openPair(a)),
          b('Nueva clave','ghost',()=>resetPass(a)),
          b(a.enabled===1?'Desactivar':'Activar',a.enabled===1?'warning':'ghost',()=>togglePlayer(a)),
          b('Eliminar','warning',()=>removePlayer(a))
        );
      }
      card.append(head,meta,info);
      if(a.instagram){
        const instagram=document.createElement('a');
        instagram.className='social-admin-link';
        instagram.href='https://www.instagram.com/'+a.instagram+'/';
        instagram.target='_blank';instagram.rel='noopener noreferrer';
        instagram.textContent='Instagram: @'+a.instagram+(a.shareSocial===1?' · autorizado':' · privado');
        card.append(instagram);
      }
      card.append(controls);frag.append(card);
    }
    $('playerCards').replaceChildren(frag);
  }
  function openEdit(a){
    const f=$('editForm').elements;f.id.value=a.id;
    f.playerName.value=a.playerName;f.email.value=a.email||'';
    f.whatsappPhone.value=a.whatsappPhone||'';f.shareWithOpponent.checked=a.shareWithOpponent===1;
    f.groupLabel.value=a.groupLabel||'';
    say('editStatus','');
    const social=$('socialAdminForm').elements;
    social.id.value=a.id;social.instagram.value=a.instagram||'';
    social.shareSocial.checked=a.shareSocial===1;
    $('adminSocialFile').value='';
    showAdminPhoto(a.hasPhoto===1?'/api/accounts?photo='+a.id+'&v='+Date.now():null,a.playerName);
    say('socialAdminStatus','');
    $('editDialog').showModal();
  }
  $('editForm').onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget.elements;
    const ok=await updatePlayer('setDetails',{
      id:Number(f.id.value),playerName:f.playerName.value,email:f.email.value,
      whatsappPhone:f.whatsappPhone.value,shareWithOpponent:f.shareWithOpponent.checked,
      groupLabel:f.groupLabel.value
    },'editStatus');
    if(ok)$('editDialog').close();
  };
  function showAdminPhoto(src,name){
    const image=$('adminAvatarPreview'),fallback=$('adminAvatarFallback');
    if(src){
      image.src=src;image.hidden=false;fallback.hidden=true;
      image.onerror=()=>{image.hidden=true;fallback.hidden=false};
    }else{
      image.removeAttribute('src');image.hidden=true;fallback.hidden=false;
      fallback.textContent=String(name||'CP').split(' ').slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
    }
  }
  async function compressProfilePhoto(file){
    if(!file)return undefined;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)
      throw Error('Selecciona un JPG, PNG o WebP de menos de 8 MB.');
    const url=URL.createObjectURL(file);
    try{
      const picture=new Image();
      await new Promise((resolve,reject)=>{
        picture.onload=resolve;picture.onerror=()=>reject(Error('No se ha podido abrir la imagen.'));
        picture.src=url;
      });
      if(!picture.naturalWidth||!picture.naturalHeight)throw Error('La imagen está vacía.');
      for(const size of [360,300,240]){
        const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('Tu navegador no puede preparar la foto.');
        ctx.fillStyle='#edf7ff';ctx.fillRect(0,0,size,size);
        const edge=Math.min(picture.naturalWidth,picture.naturalHeight);
        const left=(picture.naturalWidth-edge)/2,top=(picture.naturalHeight-edge)/2;
        ctx.drawImage(picture,left,top,edge,edge,0,0,size,size);
        for(const quality of [.78,.64,.50,.36]){
          const out=canvas.toDataURL('image/jpeg',quality);
          if(out.startsWith('data:image/jpeg;base64,')&&out.length<=113000)return out;
        }
      }
      throw Error('La foto no se pudo reducir lo suficiente. Prueba con otra imagen.');
    }finally{URL.revokeObjectURL(url)}
  }
  $('adminSocialFile').onchange=async()=>{
    const file=$('adminSocialFile').files?.[0];
    if(!file)return;
    try{
      const encoded=await compressProfilePhoto(file);
      showAdminPhoto(encoded,$('editForm').elements.playerName.value);
      say('socialAdminStatus','Foto preparada para guardar.');
    }catch(e){$('adminSocialFile').value='';say('socialAdminStatus',e.message)}
  };
  $('socialAdminForm').onsubmit=async event=>{
    event.preventDefault();
    const f=event.currentTarget.elements;
    const id=Number(f.id.value),instagram=f.instagram.value.trim(),shareSocial=f.shareSocial.checked;
    $('saveSocialAdmin').disabled=true;
    say('socialAdminStatus','Guardando Instagram y foto…');
    try{
      const payload={id,instagram,shareSocial};
      const file=$('adminSocialFile').files?.[0];
      if(file)payload.photoData=await compressProfilePhoto(file);
      const data=await api('/api/accounts',{action:'setMedia',...payload});
      accounts=data.accounts||[];renderPlayers();stats();
      $('adminSocialFile').value='';
      const updated=accounts.find(a=>a.id===id);
      if(updated)showAdminPhoto(updated.hasPhoto===1?'/api/accounts?photo='+id+'&v='+Date.now():null,updated.playerName);
      say('socialAdminStatus','Foto e Instagram guardados.');
    }catch(e){say('socialAdminStatus',e.message)}
    finally{$('saveSocialAdmin').disabled=false}
  };
  $('adminRemovePhoto').onclick=async()=>{
    const f=$('socialAdminForm').elements;
    if(!confirm('¿Quitar la fotografía de este perfil?'))return;
    const id=Number(f.id.value);
    const success=await updatePlayer('setMedia',{
      id,instagram:f.instagram.value.trim(),shareSocial:f.shareSocial.checked,photoData:''
    },'socialAdminStatus');
    if(success){$('adminSocialFile').value='';showAdminPhoto(null,$('editForm').elements.playerName.value)}
  };
  function openPair(a){
    const f=$('pairForm').elements;f.id.value=a.id;
    say('pairTitle','Asignar rival a '+a.playerName);
    const select=f.opponentId;select.replaceChildren();
    const none=document.createElement('option');none.value='';none.textContent='Sin rival';select.append(none);
    for(const other of accounts.filter(x=>x.id!==a.id&&(x.enabled===1||x.isPlaceholder===1))){
      const o=document.createElement('option');o.value=other.id;o.textContent=other.playerName;select.append(o);
    }
    const match=accounts.find(x=>x.playerName===a.opponentName);
    select.value=match?String(match.id):'';
    say('pairStatus','');$('pairDialog').showModal();
  }
  $('pairForm').onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget.elements;
    const ok=await updatePlayer('setOpponent',{id:Number(f.id.value),opponentId:f.opponentId.value?Number(f.opponentId.value):null},'pairStatus');
    if(ok)$('pairDialog').close();
  };
  async function resetPass(a){
    if(!confirm('¿Renovar la contraseña de '+a.playerName+'? La anterior dejará de funcionar.'))return;
    const password=randPass();
    if(await updatePlayer('resetPassword',{id:a.id,password}))issue(a.playerName,a.username,password);
  }
  async function togglePlayer(a){
    if(!confirm((a.enabled===1?'¿Desactivar ':'¿Activar ')+a.playerName+'?'))return;
    await updatePlayer('setEnabled',{id:a.id,enabled:a.enabled!==1});
  }
  async function removePlayer(a){
    if(!confirm('¿Eliminar definitivamente a '+a.playerName+' y sus datos personales?'))return;
    await updatePlayer('delete',{id:a.id});
  }
  // Identidad del responsable: nunca se publica sin confirmación del organizador.
  async function loadLegalSettings(){
    say('legalAdminStatus','Consultando configuración legal…');
    try{
      const res=await api('/api/legal-info?draft=1');
      const s=res.settings||{},f=$('legalForm').elements;
      for(const k of ['responsibleName','contactEmail','postalAddress','legalBasis','retentionNote'])
        f[k].value=s[k]||'';
      f.confirmAuthorized.checked=false;
      $('legalRevision').textContent=res.approved
        ?'Información aprobada · revisión '+res.revision+'.'
        :'El aviso legal está publicado como provisional: falta la validación del organizador.';
      $('legalConfigNotice').hidden=!!res.approved;
      say('legalAdminStatus','');
    }catch(e){say('legalAdminStatus',e.message)}
  }
  async function loadConsentAudit(){
    const container=$('consentAudit');
    try{
      const data=await api('/api/accounts?audit=1');
      const records=data.events||[];
      container.replaceChildren();
      if(!records.length){container.textContent='Todavía no hay permisos registrados; los cambios nuevos aparecerán aquí.';return}
      const meanings={
        whatsapp_opponent:'Compartir WhatsApp con el rival',
        photo_instagram_opponent:'Compartir foto e Instagram con el rival',
        privacy_notice_read:'Lectura del aviso confirmada por el jugador',
        privacy_notice_delivered:'Entrega del aviso declarada por administración',
        identity_opponent:'Compartir nombre real con otros participantes'
      };
      const frag=document.createDocumentFragment();
      for(const event of records){
        const el=document.createElement('article');el.className='player-card';
        const name=document.createElement('strong');name.textContent=event.playerName||'Cuenta eliminada';
        const details=document.createElement('p');details.className='small';
        const action=event.granted===1?'Sí / registrado':'No / retirado o pendiente';
        const actor=event.actor==='player'?'Acción del jugador':'Declaración administrativa';
        details.textContent=[meanings[event.purpose]||event.purpose,action,actor,event.recordedAt].join(' · ');
        el.append(name,details);frag.append(el);
      }
      container.append(frag);
    }catch(err){container.textContent='No se pudo consultar el registro: '+err.message}
  }
  $('reloadConsentAudit').onclick=loadConsentAudit;
  $('legalForm').onsubmit=async e=>{
    e.preventDefault();
    const f=e.currentTarget.elements;
    const payload={};
    for(const k of ['responsibleName','contactEmail','postalAddress','legalBasis','retentionNote'])
      payload[k]=f[k].value.trim();
    payload.confirmAuthorized=f.confirmAuthorized.checked;
    $('legalSave').disabled=true;say('legalAdminStatus','Publicando información confirmada…');
    try{
      const result=await api('/api/legal-info',payload);
      say('legalAdminStatus','Información legal publicada. Revisión '+result.revision+'.');
      $('legalConfigNotice').hidden=true;
      $('legalRevision').textContent='Datos publicados y validados por administración · revisión '+result.revision+'.';
      f.confirmAuthorized.checked=false;
    }catch(e){say('legalAdminStatus',e.message)}
    finally{$('legalSave').disabled=false}
  };
  // IMPORTACIÓN EXCEL Y CSV, SIEMPRE CON VISTA PREVIA.
  const columns=['Fecha','Jornada','Grupo','Jugador 1','Jugador 2','Set 1 J1','Set 1 J2','Set 2 J1','Set 2 J2','Set 3 J1','Set 3 J2'];
  function csvDownload(){
    const file=new Blob(['\ufeff'+columns.join(';')+'\r\n'],{type:'text/csv;charset=utf-8'});
    const link=document.createElement('a');link.href=URL.createObjectURL(file);link.download='plantilla-resultados-cpz.csv';link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  }
  $('downloadTemplate').onclick=()=>{
    if(typeof XLSX==='undefined'){csvDownload();say('importStatus','Se ha descargado CSV. Si el lector Excel no carga, puedes abrir este CSV en Excel.');return}
    const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([columns]);
    sheet['!cols']=[{wch:16},{wch:20},{wch:14},{wch:29},{wch:29},...Array.from({length:6},()=>({wch:12}))];
    XLSX.utils.book_append_sheet(book,sheet,'Resultados');
    const help=XLSX.utils.aoa_to_sheet([
      ['RANKING INDIVIDUAL CPZ 2026/27 — Cómo rellenar la plantilla'],
      ['Crea primero los perfiles de los jugadores en la web.'],
      ['Una fila por partido, fecha AAAA-MM-DD y jornada obligatoria.'],
      ['El grupo es opcional. Los nombres deben coincidir con los perfiles.'],
      ['Se juegan al mejor de tres sets a 11, siempre con 2 de diferencia.'],
      ['Deja el tercer set vacío si el mismo jugador ha ganado los dos primeros.'],
      ['La carga tiene vista previa y requiere confirmación antes de guardar.']
    ]);help['!cols']=[{wch:110}];XLSX.utils.book_append_sheet(book,help,'Instrucciones');
    XLSX.writeFile(book,'plantilla-resultados-cpz.xlsx',{compression:true});
  };
  function parseCSV(raw){
    const text=raw.replace(/^\ufeff/,'');
    const head=text.split(/\r?\n/,1)[0],sep=(head.match(/;/g)||[]).length>=(head.match(/,/g)||[]).length?';':',';
    let quoted=false,value='',line=[],rows=[];
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}
      else if(c===sep&&!quoted){line.push(value);value=''}
      else if((c==='\r'||c==='\n')&&!quoted){
        if(c==='\r'&&text[i+1]==='\n')i++;
        line.push(value);if(line.some(v=>v.trim()))rows.push(line);line=[];value='';
      }else value+=c;
    }
    line.push(value);if(line.some(v=>v.trim()))rows.push(line);
    if(quoted)throw Error('El CSV tiene comillas sin cerrar.');
    if(rows.length<2)return [];
    return rows.slice(1).map(row=>Object.fromEntries(rows[0].map((h,i)=>[h,row[i]??''])));
  }
  function parseDate(value){
    if(value instanceof Date&&!Number.isNaN(value.getTime())){
      return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
    }
    if(typeof value==='number'&&typeof XLSX!=='undefined'){
      const d=XLSX.SSF.parse_date_code(value);
      if(d)return [d.y,String(d.m).padStart(2,'0'),String(d.d).padStart(2,'0')].join('-');
    }
    const s=String(value??'').trim();
    const m=/^(\d\d?)[\/.-](\d\d?)[\/.-](\d{4})$/.exec(s);
    return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s;
  }
  function parseSets(row){
    const sets=[];for(let i=1;i<=3;i++){
      const a=row['set '+i+' j1'],b=row['set '+i+' j2'];
      if((a===''||a===undefined)&&(b===''||b===undefined))continue;
      const x=Number(a),y=Number(b);
      if(a===''||b===''||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>99||y>99||Math.max(x,y)<11||Math.abs(x-y)<2)return null;
      sets.push([x,y]);
    }
    if(sets.length!==2&&sets.length!==3)return null;
    const a=sets.filter(s=>s[0]>s[1]).length,b=sets.length-a;
    if(a!==2&&b!==2)return null;
    if(sets.length===3&&((sets[0][0]>sets[0][1])===(sets[1][0]>sets[1][1])))return null;
    return sets;
  }
  function interpret(rawRows){
    const members=new Map(accounts.filter(a=>a.enabled===1||a.isPlaceholder===1).map(a=>[clean(a.playerName),a]));
    const rows=[],issues=[],seen=new Set();
    if(!rawRows.length)issues.push('El archivo no tiene filas de resultados.');
    if(rawRows.length>200)issues.push('El máximo es de 200 partidos por archivo.');
    for(let i=0;i<rawRows.length&&i<200;i++){
      const raw=rawRows[i],r={};
      for(const key of Object.keys(raw))r[clean(key)]=raw[key];
      const date=parseDate(r.fecha??r.date),round=String(r.jornada??r.ronda??r.round??'').trim();
      const groupLabel=String(r.grupo??r.group??'').trim();
      const player1=String(r['jugador 1']??r['jugador a']??'').trim(),player2=String(r['jugador 2']??r['jugador b']??'').trim();
      const sets=parseSets(r),a=members.get(clean(player1)),b=members.get(clean(player2)),errors=[];
      const validDate=/^\d{4}-\d\d-\d\d$/.test(date)&&!Number.isNaN(new Date(date+'T00:00:00Z').getTime())&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
      if(!a||!b)errors.push('jugador no registrado');else if(a.id===b.id)errors.push('mismo jugador');
      if(!validDate)errors.push('fecha inválida');
      if(!round||round.length>60)errors.push('falta jornada');
      if(groupLabel.length>40)errors.push('grupo demasiado largo');
      if(!sets)errors.push('marcadores inválidos');
      if(a&&b){
        const key=[date,clean(round),Math.min(a.id,b.id),Math.max(a.id,b.id)].join('|');
        if(seen.has(key))errors.push('duplicado en archivo');seen.add(key);
      }
      if(errors.length)issues.push('Fila '+(i+2)+': '+errors.join(', '));
      rows.push({date,round,groupLabel,player1,player2,sets,error:errors.join(', ')});
    }
    return {rows,issues};
  }
  function clearPreview(){
    staged=[];stagedIssues=[];stagedName='';$('previewArea').hidden=true;
    $('importCommit').disabled=true;$('importSummary').textContent='Selecciona un archivo para comprobar los marcadores antes de guardarlos.';
  }
  $('clearPreview').onclick=()=>{clearPreview();$('excelInput').value='';say('importStatus','')};
  $('importForm').onsubmit=async e=>{
    e.preventDefault();clearPreview();say('importStatus','Leyendo archivo…');
    const file=$('excelInput').files?.[0];if(!file)return;
    if(file.size>4*1024*1024){say('importStatus','El archivo supera los 4 MB.');return}
    try{
      let rawRows;
      if(/\.csv$/i.test(file.name))rawRows=parseCSV(await file.text());
      else{
        if(typeof XLSX==='undefined')throw Error('El lector de Excel no está disponible. Puedes exportar el archivo como CSV.');
        const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
        const name=workbook.SheetNames.find(n=>clean(n)==='resultados')||workbook.SheetNames[0];
        if(!name)throw Error('El Excel no tiene hojas.');
        rawRows=XLSX.utils.sheet_to_json(workbook.Sheets[name],{defval:'',raw:true});
      }
      const parsed=interpret(rawRows);
      staged=parsed.rows.filter(x=>!x.error).map(({error,...x})=>x);
      stagedIssues=parsed.issues;stagedName=file.name;
      $('importSummary').textContent=parsed.rows.length+' filas · '+staged.length+' válidas · '+stagedIssues.length+' errores';
      const table=document.createElement('table'),tbody=document.createElement('tbody'),thead=document.createElement('thead');
      thead.innerHTML='<tr><th>Fila</th><th>Fecha</th><th>Jornada</th><th>Jugador 1</th><th>Jugador 2</th><th>Sets</th><th>Estado</th></tr>';
      parsed.rows.forEach((r,i)=>{
        const tr=document.createElement('tr');
        [i+2,r.date,r.round,r.player1,r.player2,(r.sets||[]).map(s=>s.join('-')).join(' / '),r.error||'Correcto'].forEach((v,j)=>{
          const td=document.createElement('td');td.textContent=v;if(j===6)td.className=r.error?'bad':'good';tr.append(td);
        });tbody.append(tr);
      });
      table.append(thead,tbody);$('importTable').replaceChildren(table);$('previewArea').hidden=false;
      $('importCommit').disabled=stagedIssues.length>0||staged.length===0;
      say('importStatus',stagedIssues.length?stagedIssues.slice(0,5).join(' · '):'Validación correcta. Confirma cuando hayas revisado el archivo.');
    }catch(err){clearPreview();say('importStatus',err.message)}
  };
  $('importCommit').onclick=async()=>{
    if(!staged.length||stagedIssues.length)return;
    if(!confirm('¿Guardar '+staged.length+' resultados de '+stagedName+'?'))return;
    $('importCommit').disabled=true;say('importStatus','Guardando resultados…');
    try{
      const d=await api('/api/results',{action:'import',rows:staged,confirm:true,fileName:stagedName,replaceExisting:$('replaceExisting').checked});
      results=d.results||[];renderResults();renderGroups();updateOperations();renderSeasonHistory();stats();
      say('importStatus',d.imported+' resultados guardados.');clearPreview();$('excelInput').value='';
    }catch(err){
      say('importStatus',err.message+(err.details?.length?' '+err.details.slice(0,5).join(' · '):''));
      $('importCommit').disabled=false;
    }
  };
  function renderRecentResults(){
    const panel=$('adminRecentResults');
    if(!panel)return;
    const recent=results.slice(0,4);
    panel.replaceChildren();
    if(!recent.length){
      const message=document.createElement('div');message.className='tour-empty';
      const title=document.createElement('strong');title.textContent='Sin partidos confirmados todavía';
      const detail=document.createElement('span');detail.textContent='Registra manualmente los resultados para que los encuentros aparezcan aquí.';
      message.append(title,detail);panel.append(message);return;
    }
    const fragment=document.createDocumentFragment();
    recent.forEach((r,i)=>{
      const card=document.createElement('article');card.className='tour-match';
      const number=document.createElement('span');number.className='tour-match-number';number.textContent=String(i+1).padStart(2,'0');
      const content=document.createElement('div');content.className='tour-match-content';
      const meta=document.createElement('span');meta.className='tour-match-meta';meta.textContent=[r.date,r.round,r.groupLabel].filter(Boolean).join(' · ');
      const names=document.createElement('strong');names.className='tour-match-names';names.textContent=r.player1+'  vs  '+r.player2;
      content.append(meta,names);
      const score=document.createElement('span');score.className='tour-match-score';
      score.textContent=(r.sets||[]).map(set=>Array.isArray(set)?set.join('–'):'').filter(Boolean).join('  /  ')||'Resultado registrado';
      card.append(number,content,score);fragment.append(card);
    });
    panel.append(fragment);
  }

  let manualEditingId=null;
  const manualAccount=name=>accounts.find(a=>clean(a.playerName)===clean(name));
  const manualFixtures=()=>{
    const group=$('manualGroup').value,names=NOVEMBER_ROSTER[group]||[],select=$('manualFixture');
    const prior=select.value;select.replaceChildren();
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecciona un partido';select.append(placeholder);
    for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
      const opt=document.createElement('option');opt.value=names[i]+'||'+names[j];
      const already=results.some(r=>clean(r.groupLabel)===clean(group)&&((clean(r.player1)===clean(names[i])&&clean(r.player2)===clean(names[j]))||(clean(r.player1)===clean(names[j])&&clean(r.player2)===clean(names[i]))));
      opt.textContent=names[i]+' contra '+names[j]+(already?' · Resultado registrado':'');
      select.append(opt);
    }
    if([...select.options].some(x=>x.value===prior&&!x.disabled))select.value=prior;
    manualSelected();
  };
  function manualSelected(){
    const selected=$('manualFixture').value.split('||');
    $('manualPlayersHint').textContent=selected.length===2?'Jugador 1: '+selected[0]+' · Jugador 2: '+selected[1]:'Elige uno de los seis partidos del grupo. No es necesario crear cuentas personales.';
  }
  function resetManual(){
    manualEditingId=null;$('manualResultForm').reset();$('manualFormTitle').textContent='Nuevo resultado';
    $('manualSave').textContent='Guardar resultado';$('manualRound').value='Noviembre 2026';
    $('manualDate').value=new Date().toISOString().slice(0,10);
    manualFixtures();say('manualStatus','');
  }
  function editManual(r){
    manualEditingId=r.id;$('manualFormTitle').textContent='Editar resultado nº '+r.id;
    $('manualSave').textContent='Guardar cambios';$('manualGroup').value=r.groupLabel||'';
    manualFixtures();const wanted=[r.player1,r.player2].map(clean);
    const selection=[...$('manualFixture').options].find(o=>o.value&&o.value.split('||').map(clean).every(v=>wanted.includes(v)));
    if(selection){$('manualFixture').value=selection.value;manualSelected()}
    $('manualDate').value=r.date;$('manualRound').value=r.round;
    const flipped=selection&&clean(selection.value.split('||')[0])!==clean(r.player1);
    for(let n=1;n<=3;n++){const scores=r.sets?.[n-1]||[];$('manualSet'+n+'a').value=scores.length?String(scores[flipped?1:0]):'';$('manualSet'+n+'b').value=scores.length?String(scores[flipped?0:1]):''}
    document.getElementById('page-results').scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('manualGroup').addEventListener('change',()=>{manualEditingId=null;manualFixtures()});
  $('manualFixture').addEventListener('change',manualSelected);
  $('manualReset').addEventListener('click',resetManual);
  $('manualResultForm').addEventListener('submit',async event=>{
    event.preventDefault();const pair=$('manualFixture').value.split('||');
    if(pair.length!==2)return say('manualStatus','Selecciona un partido.');
    const sets=[];
    for(let n=1;n<=3;n++){const a=$('manualSet'+n+'a').value,b=$('manualSet'+n+'b').value;
      if(!a&&!b&&n===3)continue;if(a===''||b==='')return say('manualStatus','Indica ambos marcadores en cada set.');sets.push([Number(a),Number(b)])}
    $('manualSave').disabled=true;
    try{
      const d=await api('/api/results',{action:'manual-save',id:manualEditingId,date:$('manualDate').value,round:$('manualRound').value,groupLabel:$('manualGroup').value,player1Name:pair[0],player2Name:pair[1],sets});
      results=d.results||[];renderResults();renderGroups();updateOperations();renderSeasonHistory();resetManual();
      say('manualStatus','Resultado guardado correctamente.');
    }catch(e){say('manualStatus',e.message)}
    finally{$('manualSave').disabled=false}
  });
  resetManual();
  function renderResults(){
    stats();$('resultLabel').textContent=results.length+' resultados guardados';
    renderRecentResults();
    if(!results.length){$('resultTable').innerHTML='<div class="empty">Aún no hay resultados. Selecciona un grupo y guarda el primero manualmente.</div>';return}
    const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody');
    head.innerHTML='<tr><th>Fecha</th><th>Jornada</th><th>Grupo</th><th>Jugadores</th><th>Marcadores</th><th>Ganador</th><th>Acción</th></tr>';
    for(const r of results){
      const tr=document.createElement('tr');
      [r.date,r.round,r.groupLabel||'—',r.player1+' vs '+r.player2,(r.sets||[]).map(v=>v.join('-')).join(' · '),r.winner].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});
      const cell=document.createElement('td');
      cell.append(b('Editar','secondary',()=>editManual(r)));
      cell.append(b('Eliminar','warning',async()=>{
        if(!confirm('¿Eliminar este resultado?'))return;
        try{const d=await api('/api/results',{action:'delete',id:r.id});results=d.results||[];renderResults();renderGroups();manualFixtures()}
        catch(e){say('manualStatus',e.message)}
      }));tr.append(cell);body.append(tr);
    }
    table.append(head,body);$('resultTable').replaceChildren(table);
  }
  async function loadResults(){
    try{const d=await api('/api/results');results=d.results||[];renderResults();manualFixtures()}
    catch(e){$('resultTable').innerHTML='<div class="empty">'+H(e.message)+'</div>'}
  }
  $('refreshResults').onclick=loadResults;
  // Comunidad existente, sin vídeos falsos.
  async function loadVideos(){
    try{community=await api('/api/community');renderVideos();say('videoStatus','')}
    catch(e){say('videoStatus',e.message)}
  }
  function renderVideos(){
    const frag=document.createDocumentFragment();
    for(const v of community.videos||[]){
      const el=document.createElement('div');el.className='video-item';
      const title=document.createElement('strong');title.textContent=v.title;
      const link=document.createElement('a');link.href='https://www.youtube.com/watch?v='+v.youtubeId;
      link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir vídeo ↗';
      el.append(title,link,b('Eliminar','warning',()=>deleteVideo('removeVideo',v.id)));frag.append(el);
    }
    for(const c of community.channels||[]){
      const el=document.createElement('div');el.className='video-item';
      const title=document.createElement('strong');title.textContent=c.playerName+' — '+c.channelName;
      const link=document.createElement('a');link.href=c.channelUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Ver canal ↗';
      el.append(title,link,b('Eliminar','warning',()=>deleteVideo('removeChannel',c.id)));frag.append(el);
    }
    $('videoList').replaceChildren(frag);
    if(!community.videos?.length&&!community.channels?.length)$('videoList').innerHTML='<div class="empty">Todavía no se han añadido vídeos ni canales autorizados.</div>';
  }
  async function deleteVideo(action,id){
    if(!confirm('¿Retirar este contenido?'))return;
    try{community=await api('/api/community',{action,id});renderVideos()}catch(e){say('videoStatus',e.message)}
  }
  $('refreshVideos').onclick=loadVideos;
  $('channelForm').onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget.elements;
    try{
      community=await api('/api/community',{action:'addChannel',playerName:f.playerName.value,channelName:f.channelName.value,channelUrl:f.channelUrl.value,consentConfirmed:f.consentConfirmed.checked});
      e.currentTarget.reset();renderVideos();say('videoStatus','Canal guardado.');
    }catch(err){say('videoStatus',err.message)}
  };
  $('videoForm').onsubmit=async e=>{
    e.preventDefault();const f=e.currentTarget.elements;
    try{
      community=await api('/api/community',{action:'addVideo',title:f.title.value,url:f.url.value,playerOne:f.playerOne.value,playerTwo:f.playerTwo.value,description:f.description.value,consentConfirmed:f.consentConfirmed.checked});
      e.currentTarget.reset();renderVideos();say('videoStatus','Vídeo guardado.');
    }catch(err){say('videoStatus',err.message)}
  };
  // Configuración de la única contraseña de lectura, sin perfiles individuales.
  const sharedForm=$('sharedPasswordForm');
  if(sharedForm){
    const status=$('sharedPasswordStatus');
    async function loadSharedConfig(){
      try{
        const res=await fetch('/api/shared/config',{credentials:'same-origin',cache:'no-store'});
        const data=await res.json();
        status.textContent=data.configured
          ?'La contraseña general está configurada. Puedes cambiarla cuando quieras; el cambio cerrará las sesiones anteriores.'
          :'Todavía no hay contraseña general. Configúrala antes de dar acceso a jugadores.';
      }catch(err){status.textContent='No se pudo consultar la configuración.'}
    }
    sharedForm.addEventListener('submit',async event=>{
      event.preventDefault();
      const password=$('sharedPassword').value;
      if(password.length<12){status.textContent='Introduce al menos 12 caracteres.';return}
      const button=sharedForm.querySelector('button[type="submit"]');button.disabled=true;
      try{
        const response=await fetch('/api/shared/config',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({password})});
        const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo guardar');
        sharedForm.reset();status.textContent=data.message;
      }catch(err){status.textContent=err.message}
      finally{button.disabled=false}
    });
    loadSharedConfig();
  }
  (async()=>{try{
    const session=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());
    if(!session.authenticated){location.replace('/');return}
    await Promise.all([loadPlayers(),loadResults()]);
  }catch(e){say('playerStatus',e.message)}})();
})();
