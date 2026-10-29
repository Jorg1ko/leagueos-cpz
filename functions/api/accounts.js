// CPZ 2026/27 — altas y administración de cuentas de jugadores.
// Únicamente accesible con la sesión original del administrador.
const ADMIN_COOKIE='__Host-leagueos_admin';
const AGE=8*60*60;
const ITERATIONS=310000;
const te=new TextEncoder();
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
function validName(v){return typeof v==='string'&&v.trim().length>=2&&v.trim().length<=100&&!/[<>\u0000-\u001f]/.test(v);}
function cleanEmail(v){
  if(v===undefined||v===null||v==='')return '';
  if(typeof v!=='string'||v.length>160)return null;
  const x=v.trim().toLowerCase();
  return x.length===0||(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x)&&x.length<=160)?x:null;
}
function validGroup(v){return typeof v==='string'&&v.trim().length<=35&&!/[<>\u0000-\u001f]/.test(v);}

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
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_player_profiles (account_id INTEGER PRIMARY KEY REFERENCES cpz_player_accounts(id) ON DELETE CASCADE, email TEXT NOT NULL DEFAULT '', group_label TEXT NOT NULL DEFAULT '', preferred_name TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
async function records(db){
  const result=await db.prepare(
    "SELECT a.id,a.player_name AS playerName,a.username,a.enabled,a.opponent_name AS opponentName,a.created_at AS createdAt,COALESCE(c.whatsapp_phone,'') AS whatsappPhone,COALESCE(c.share_with_opponent,0) AS shareWithOpponent,COALESCE(p.email,'') AS email,COALESCE(p.group_label,'') AS groupLabel FROM cpz_player_accounts a LEFT JOIN cpz_player_contacts c ON c.account_id=a.id LEFT JOIN cpz_player_profiles p ON p.account_id=a.id ORDER BY a.player_name COLLATE NOCASE LIMIT 2000"
  ).all();
  const accounts=result.results||[];
  return {ok:true,accounts,totalPlayers:accounts.length};
}
async function saveProfile(db,id,email,group){
  await db.prepare('INSERT INTO cpz_player_profiles(account_id,email,group_label,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(account_id) DO UPDATE SET email=excluded.email,group_label=excluded.group_label,updated_at=CURRENT_TIMESTAMP')
    .bind(id,email,group).run();
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
      const playerName=typeof body.playerName==='string'?body.playerName.trim():'';
      const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
      const email=cleanEmail(body.email);
      const group=typeof body.groupLabel==='string'?body.groupLabel.trim():'';
      const contact=contactInput(body);
      if(!validName(playerName)||!userRe.test(username)||!validPassword(body.password)||email===null||!validGroup(group)||!contact)
        return fail('Comprueba nombre, usuario, email, contraseña y teléfono. La contraseña debe tener al menos 12 caracteres.');
      if(await env.LEAGUE_DB.prepare('SELECT id FROM cpz_player_accounts WHERE lower(player_name)=lower(?) OR username=? COLLATE NOCASE LIMIT 1').bind(playerName,username).first())
        return fail('Ya existe un jugador con ese nombre o usuario.',409);
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const digest=await passwordHash(body.password,salt);
      try{
        const inserted=await env.LEAGUE_DB.prepare('INSERT INTO cpz_player_accounts (player_name,username,password_salt,password_hash,opponent_name) VALUES(?,?,?,?,?)')
          .bind(playerName,username,b64(salt),digest,'').run();
        const id=inserted.meta?.last_row_id;
        if(!id)throw Error('No se pudo obtener el ID del jugador');
        await storeContact(env.LEAGUE_DB,id,contact);
        await saveProfile(env.LEAGUE_DB,id,email,group);
      }catch(e){
        if(/constraint|unique/i.test(String(e)))return fail('Ese nombre o usuario ya existe.',409);
        throw e;
      }
    }else if(action==='setContact'){
      const id=identifier(body.id);
      const contact=contactInput(body);
      if(!id||!contact)return fail('Introduce un número válido (+34 para España) y confirma el permiso para compartirlo.');
      const existing=await env.LEAGUE_DB.prepare('SELECT id FROM cpz_player_accounts WHERE id=?').bind(id).first();
      if(!existing)return fail('Cuenta no encontrada.',404);
      await storeContact(env.LEAGUE_DB,id,contact);
    }else if(action==='setDetails'){
      const id=identifier(body.id);
      const name=typeof body.playerName==='string'?body.playerName.trim():'';
      const email=cleanEmail(body.email);
      const group=typeof body.groupLabel==='string'?body.groupLabel.trim():'';
      const contact=contactInput(body);
      if(!id||!validName(name)||email===null||!validGroup(group)||!contact)return fail('Datos del perfil inválidos.');
      const original=await env.LEAGUE_DB.prepare('SELECT player_name FROM cpz_player_accounts WHERE id=?').bind(id).first();
      if(!original)return fail('Cuenta no encontrada.',404);
      const duplicate=await env.LEAGUE_DB.prepare('SELECT id FROM cpz_player_accounts WHERE lower(player_name)=lower(?) AND id<>?').bind(name,id).first();
      if(duplicate)return fail('Ya existe otro jugador con ese nombre.',409);
      await env.LEAGUE_DB.batch([
        env.LEAGUE_DB.prepare('UPDATE cpz_player_accounts SET player_name=? WHERE id=?').bind(name,id),
        env.LEAGUE_DB.prepare('UPDATE cpz_player_accounts SET opponent_name=? WHERE opponent_name=?').bind(name,original.player_name)
      ]);
      await saveProfile(env.LEAGUE_DB,id,email,group);
      await storeContact(env.LEAGUE_DB,id,contact);
    }else if(action==='setOpponent'){
      const id=identifier(body.id),other=body.opponentId===null?null:identifier(body.opponentId);
      if(!id||(body.opponentId!==null&&!other)||(id===other))return fail('Elige dos jugadores distintos o borra el rival.');
      const player=await env.LEAGUE_DB.prepare('SELECT id,player_name FROM cpz_player_accounts WHERE id=? AND enabled=1').bind(id).first();
      if(!player)return fail('Jugador no disponible.',404);
      const opponent=other?await env.LEAGUE_DB.prepare('SELECT id,player_name FROM cpz_player_accounts WHERE id=? AND enabled=1').bind(other).first():null;
      if(other&&!opponent)return fail('Rival no disponible.',404);
      // Borra las antiguas parejas de ambos jugadores y establece un cruce recíproco.
      const steps=[
        env.LEAGUE_DB.prepare("UPDATE cpz_player_accounts SET opponent_name='' WHERE player_name IN (?,?) OR opponent_name IN (?,?)")
          .bind(player.player_name,opponent?.player_name||'',player.player_name,opponent?.player_name||'')
      ];
      if(opponent)steps.push(
        env.LEAGUE_DB.prepare('UPDATE cpz_player_accounts SET opponent_name=? WHERE id=?').bind(opponent.player_name,id),
        env.LEAGUE_DB.prepare('UPDATE cpz_player_accounts SET opponent_name=? WHERE id=?').bind(player.player_name,other)
      );
      await env.LEAGUE_DB.batch(steps);
    }else if(action==='delete'){
      const id=identifier(body.id);
      if(!id)return fail('Identificador inválido.');
      const player=await env.LEAGUE_DB.prepare('SELECT player_name FROM cpz_player_accounts WHERE id=?').bind(id).first();
      if(!player)return fail('Jugador no encontrado.',404);
      await env.LEAGUE_DB.batch([
        env.LEAGUE_DB.prepare("UPDATE cpz_player_accounts SET opponent_name='' WHERE opponent_name=?").bind(player.player_name),
        env.LEAGUE_DB.prepare('DELETE FROM cpz_player_contacts WHERE account_id=?').bind(id),
        env.LEAGUE_DB.prepare('DELETE FROM cpz_player_profiles WHERE account_id=?').bind(id),
        env.LEAGUE_DB.prepare('DELETE FROM cpz_player_accounts WHERE id=?').bind(id)
      ]);
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