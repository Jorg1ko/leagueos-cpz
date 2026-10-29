// CPZ 2026/27 — altas y administración de cuentas de jugadores.
// Únicamente accesible con la sesión original del administrador.
const ADMIN_COOKIE='__Host-leagueos_admin';
const AGE=8*60*60;
const ITERATIONS=310000;
const te=new TextEncoder();
const roster=["Carlos Guillén","Jorge Corbas","Eduardo Alvira","Juan Jiménez","Chema Balmori","Mariano Guillén","Jorge Delgado","Alejandro Mendívil","Javier Gimeno","Óscar Pinilla","Jaime Mengual","Felipe Echevarría","Mario Pintanel","Álvaro Esteban","Pedro Hernández","Jorge Ramón García","Marcos Domeque","Ramón Ruiz de Conejo","Ignacio Algas","Javier Royo","Marco Antonio Lamata","David Calavia","David Serrate","Roberto Moreno","Enzo Navarro","Irene Martínez","Carlos Lama","Alejandro Embid","David Martos","Carlos Vilar","Álex Aznar","Orlando Aguilar","Manuel Ángel Berges","Emilio Martín","Diego Cuervo","Dani Sevil","Pablo Oliván","Gabriel Tena","Raúl García","Antonio Estopañán"];
const fail=(message,status=400)=>respond({ok:false,error:message},status);
function respond(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'private, no-store, max-age=0',
    'X-Content-Type-Options':'nosniff'
  }});
}
async function admin(request,secret){
  if(typeof secret!=='string'||secret.length<12)return false;
  const cookie=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(v=>v.startsWith(ADMIN_COOKIE+'='));
  if(!cookie)return false;
  const p=cookie.slice(ADMIN_COOKIE.length+1).split('.');
  if(p.length!==4||p[0]!=='1'||!/^[0-9]{13}$/.test(p[1]))return false;
  const exp=Number(p[1]);if(exp<Date.now()||exp>Date.now()+AGE*1000)return false;
  try{
    const raw=p[3].replace(/-/g,'+').replace(/_/g,'/');
    const bytes=Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    return await crypto.subtle.verify('HMAC',key,bytes,te.encode(p.slice(0,3).join('.')));
  }catch{return false}
}
function originOK(request){
  if((request.headers.get('Content-Type')||'').split(';')[0].toLowerCase().trim()!=='application/json')return false;
  const base=new URL(request.url).origin;
  const origin=request.headers.get('Origin');
  if(origin)return origin===base;
  const site=request.headers.get('Sec-Fetch-Site');
  if(site)return site==='same-origin';
  try{return new URL(request.headers.get('Referer')).origin===base}catch{return false}
}
async function parseJSON(request){
  if(Number(request.headers.get('Content-Length')||0)>2600)throw Error('Solicitud demasiado grande.');
  const raw=await request.text();
  if(raw.length>2600)throw Error('Solicitud demasiado grande.');
  return JSON.parse(raw);
}
function b64(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function passwordHash(password,salt){
  const key=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveBits']);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},key,256)));
}
function validPassword(s){return typeof s==='string'&&s.length>=12&&s.length<=128}
const userRe=/^[a-z0-9][a-z0-9._-]{2,31}$/;
function normalizedPhone(value){
  if(value===null||value===undefined||value==='')return '';
  if(typeof value!=='string'||value.length>45)return null;
  let raw=value.trim().replace(/[\s().-]/g,'');
  if(raw.startsWith('00'))raw='+'+raw.slice(2);
  if(/^[67]\d{8}$/.test(raw))raw='+34'+raw;
  else if(/^34[67]\d{8}$/.test(raw))raw='+'+raw;
  return /^\+[1-9]\d{7,14}$/.test(raw)?raw:null;
}
function contactInput(body){
  const phone=normalizedPhone(body.whatsappPhone);
  if(phone===null||typeof body.shareWithOpponent!=='boolean'||(body.shareWithOpponent&&!phone))return null;
  return {phone,shared:body.shareWithOpponent?1:0};
}
async function storeContact(db,id,contact){
  await db.prepare('INSERT INTO cpz_player_contacts (account_id,whatsapp_phone,share_with_opponent,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(account_id) DO UPDATE SET whatsapp_phone=excluded.whatsapp_phone,share_with_opponent=excluded.share_with_opponent,updated_at=CURRENT_TIMESTAMP')
    .bind(id,contact.phone,contact.shared).run();
}
async function prepare(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_player_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, player_name TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, session_version INTEGER NOT NULL DEFAULT 1, opponent_name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_player_contacts (account_id INTEGER PRIMARY KEY REFERENCES cpz_player_accounts(id) ON DELETE CASCADE, whatsapp_phone TEXT NOT NULL DEFAULT '', share_with_opponent INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
async function records(db){
  const result=await db.prepare("SELECT a.id,a.player_name AS playerName,a.username,a.enabled,a.opponent_name AS opponentName,a.created_at AS createdAt,COALESCE(c.whatsapp_phone,'') AS whatsappPhone,COALESCE(c.share_with_opponent,0) AS shareWithOpponent FROM cpz_player_accounts a LEFT JOIN cpz_player_contacts c ON c.account_id=a.id ORDER BY a.player_name COLLATE NOCASE LIMIT 100").all();
  return {ok:true,accounts:result.results||[],totalPlayers:roster.length};
}
function identifier(value){
  const id=Number(value);return Number.isSafeInteger(id)&&id>0?id:null;
}
export async function onRequest({request,env}){
  try{
    if(!env.LEAGUE_DB||!(await admin(request,env.ADMIN_PASSWORD)))
      return fail('Acceso exclusivo del administrador.',401);
    if(!['GET','POST'].includes(request.method))return fail('Método no permitido.',405);
    if(request.method==='POST'&&!originOK(request))return fail('Origen no autorizado.',403);
    await prepare(env.LEAGUE_DB);
    if(request.method==='GET')return respond(await records(env.LEAGUE_DB));
    const body=await parseJSON(request);
    if(!body||typeof body!=='object')return fail('Solicitud inválida.');
    const action=body.action;
    if(action==='create'){
      const playerName=body.playerName;
      const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
      if(!roster.includes(playerName))return fail('Selecciona uno de los participantes registrados.');
      if(!userRe.test(username))return fail('El usuario debe tener entre 3 y 32 caracteres: letras sin tildes, números, punto, guion o guion bajo.');
      if(!validPassword(body.password))return fail('La contraseña provisional debe tener entre 12 y 128 caracteres.');
      const contact=contactInput(body);
      if(!contact)return fail('Número de WhatsApp inválido o falta indicar si puede compartirse con el rival.');
      const index=roster.indexOf(playerName);
      const opponentName=roster[index%2?index-1:index+1];
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const digest=await passwordHash(body.password,salt);
      try{
        const inserted=await env.LEAGUE_DB.prepare('INSERT INTO cpz_player_accounts (player_name,username,password_salt,password_hash,opponent_name) VALUES(?,?,?,?,?)')
          .bind(playerName,username,b64(salt),digest,opponentName).run();
        const createdId=inserted.meta?.last_row_id;
        if(!createdId)throw Error('Identificador de nueva cuenta ausente');
        await storeContact(env.LEAGUE_DB,createdId,contact);
      }catch(e){
        if(/constraint|unique/i.test(String(e)))return fail('Ese jugador o nombre de usuario ya tiene una cuenta.',409);
        throw e;
      }
    }else if(action==='setContact'){
      const id=identifier(body.id);
      const contact=contactInput(body);
      if(!id||!contact)return fail('Introduce un número válido (+34 para España) y confirma el permiso para compartirlo.');
      const existing=await env.LEAGUE_DB.prepare('SELECT id FROM cpz_player_accounts WHERE id=?').bind(id).first();
      if(!existing)return fail('Cuenta no encontrada.',404);
      await storeContact(env.LEAGUE_DB,id,contact);
    }else if(action==='resetPassword'){
      const id=identifier(body.id);
      if(!id||!validPassword(body.password))return fail('Selecciona una cuenta y una contraseña provisional de al menos 12 caracteres.');
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const digest=await passwordHash(body.password,salt);
      const changed=await env.LEAGUE_DB.prepare('UPDATE cpz_player_accounts SET password_salt=?,password_hash=?,session_version=session_version+1 WHERE id=?')
        .bind(b64(salt),digest,id).run();
      if(changed.meta?.changes!==1)return fail('Cuenta no encontrada.',404);
    }else if(action==='setEnabled'){
      const id=identifier(body.id);
      if(!id||typeof body.enabled!=='boolean')return fail('Datos inválidos.');
      const changed=await env.LEAGUE_DB.prepare('UPDATE cpz_player_accounts SET enabled=?,session_version=session_version+1 WHERE id=?')
        .bind(body.enabled?1:0,id).run();
      if(changed.meta?.changes!==1)return fail('Cuenta no encontrada.',404);
    }else return fail('Operación no reconocida.',404);
    return respond(await records(env.LEAGUE_DB));
  }catch(error){
    console.error('CPZ accounts',error?.name||'error');
    return fail('No se pudo completar la gestión de cuentas. Comprueba el servidor.',500);
  }
}