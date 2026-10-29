// RANKING INDIVIDUAL CPZ 2026/27 — panel de administración.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clean = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim().replace(/\s+/g, ' ');
  const H = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let accounts = [], results = [], community = {channels:[], videos:[]}, staged = [], stagedIssues = [], stagedName = '', issued = null;
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
  function say(id, text) {$(id).textContent=text || '';}
  function stats() {
    $('playerCount').textContent=accounts.length;
    $('activeCount').textContent=accounts.filter(x=>x.enabled===1).length;
    $('pairedCount').textContent=accounts.filter(x=>x.opponentName).length;
    $('resultCount').textContent=results.length;
    $('resultLabel').textContent=results.length+' partidos guardados';
  }
  function show(name) {
    currentView=name;
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='page-'+name);
    if(name==='players')loadPlayers();
    if(name==='results')loadResults();
    if(name==='videos')loadVideos();
    if(name==='legal'){loadLegalSettings();loadConsentAudit()}
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
      accounts=d.accounts||[];renderPlayers();stats();say(id,'Cambios guardados.');return true;
    }catch(e){say(id,e.message);return false}
  }
  async function loadPlayers(){
    try{
      const data=await api('/api/accounts');accounts=data.accounts||[];renderPlayers();stats();say('playerStatus','');
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
      const meta=document.createElement('p');meta.className='small';meta.textContent='@'+a.username+' · '+(a.email||'Sin correo')+' · Grupo '+(a.groupLabel||'pendiente');
      const info=document.createElement('p');info.className='small';
      info.textContent='Rival: '+(a.opponentName||'Sin asignar')+' · WhatsApp '+(a.whatsappPhone||'pendiente')+(a.shareWithOpponent===1?' (autorizado)':' (privado)');
      const controls=document.createElement('div');controls.className='actions';
      controls.append(
        b('Editar','secondary',()=>openEdit(a)),
        b('Asignar rival','secondary',()=>openPair(a)),
        b('Nueva clave','ghost',()=>resetPass(a)),
        b(a.enabled===1?'Desactivar':'Activar',a.enabled===1?'warning':'ghost',()=>togglePlayer(a)),
        b('Eliminar','warning',()=>removePlayer(a))
      );
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
    for(const other of accounts.filter(x=>x.id!==a.id&&x.enabled===1)){
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
        privacy_notice_delivered:'Entrega del aviso declarada por administración'
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
    const members=new Map(accounts.filter(a=>a.enabled===1).map(a=>[clean(a.playerName),a]));
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
      results=d.results||[];renderResults();stats();
      say('importStatus',d.imported+' resultados guardados.');clearPreview();$('excelInput').value='';
    }catch(err){
      say('importStatus',err.message+(err.details?.length?' '+err.details.slice(0,5).join(' · '):''));
      $('importCommit').disabled=false;
    }
  };
  function renderResults(){
    stats();$('resultLabel').textContent=results.length+' resultados guardados';
    if(!results.length){$('resultTable').innerHTML='<div class="empty">Aún no hay resultados. Importa el primer Excel cuando estén creadas las cuentas.</div>';return}
    const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody');
    head.innerHTML='<tr><th>Fecha</th><th>Jornada</th><th>Grupo</th><th>Jugadores</th><th>Marcadores</th><th>Ganador</th><th>Acción</th></tr>';
    for(const r of results){
      const tr=document.createElement('tr');
      [r.date,r.round,r.groupLabel||'—',r.player1+' vs '+r.player2,(r.sets||[]).map(v=>v.join('-')).join(' · '),r.winner].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});
      const cell=document.createElement('td');
      cell.append(b('Eliminar','warning',async()=>{
        if(!confirm('¿Eliminar este resultado?'))return;
        try{const d=await api('/api/results',{action:'delete',id:r.id});results=d.results||[];renderResults()}
        catch(e){say('importStatus',e.message)}
      }));tr.append(cell);body.append(tr);
    }
    table.append(head,body);$('resultTable').replaceChildren(table);
  }
  async function loadResults(){
    try{const d=await api('/api/results');results=d.results||[];renderResults()}
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
  (async()=>{try{
    const session=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json());
    if(!session.authenticated){location.replace('/');return}
    await Promise.all([loadPlayers(),loadResults()]);
  }catch(e){say('playerStatus',e.message)}})();
})();
