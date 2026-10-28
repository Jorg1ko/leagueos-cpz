// CPZ 2026/27 — inicio de sesión de jugadores y perfil de acceso reducido.
// Cookie independiente de administrador, con firma HMAC, versión y caducidad.
const SESSION='__Host-cpz_member';
const TTL=8*60*60;
const ITERATIONS=310000;
const te=new TextEncoder();
const respond=(data,status=200,cookie)=>{const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});if(cookie)headers.set('Set-Cookie',cookie);return new Response(JSON.stringify(data),{status,headers})};
const fail=(message,status=400)=>respond({ok:false,error:message},status);
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function unb64(value){const raw=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0))}
async function hmacKey(secret){return crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function issue(id,version,secret){
  const expires=Date.now()+TTL*1000,nonce=b64(crypto.getRandomValues(new Uint8Array(16)));
  const payload='1.'+id+'.'+version+'.'+expires+'.'+nonce;
  const signature=b64(new Uint8Array(await crypto.subtle.sign('HMAC',await hmacKey(secret),te.encode('CPZ_PLAYER_SESSION_V1|'+payload))));
  return SESSION+'='+payload+'.'+signature+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+TTL;
}
const clear=SESSION+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
async function member(request,env){
  if(!env.LEAGUE_DB||typeof env.ADMIN_PASSWORD!=='string'||env.ADMIN_PASSWORD.length<12)return null;
  const cookie=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(v=>v.startsWith(SESSION+'='));
  if(!cookie)return null;
  const p=cookie.slice(SESSION.length+1).split('.');
  if(p.length!==6||p[0]!=='1'||! /^[0-9]{13}$/.test(p[3]))return null;
  const id=Number(p[1]),version=Number(p[2]),expires=Number(p[3]);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(version)||version<1||expires<Date.now()||expires>Date.now()+TTL*1000)return null;
  try{
    const payload=p.slice(0,5).join('.');
    const valid=await crypto.subtle.verify('HMAC',await hmacKey(env.ADMIN_PASSWORD),unb64(p[5]),te.encode('CPZ_PLAYER_SESSION_V1|'+payload));
    if(!valid)return null;
    const row=await env.LEAGUE_DB.prepare('SELECT id,player_name,username,opponent_name,enabled,session_version,password_hash,password_salt FROM cpz_player_accounts WHERE id=? LIMIT 1').bind(id).first();
    return row&&row.enabled===1&&row.session_version===version?row:null;
  }catch(e){return null}
}
function originOK(request){
  if((request.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return false;
  const base=new URL(request.url).origin,origin=request.headers.get('Origin');
  if(origin)return origin===base;
  const site=request.headers.get('Sec-Fetch-Site');
  if(site)return site==='same-origin';
  try{return new URL(request.headers.get('Referer')).origin===base}catch{return false}
}
async function body(request){
  if(Number(request.headers.get('Content-Length')||0)>2000)throw Error('Solicitud demasiado grande.');
  const raw=await request.text();if(raw.length>2000)throw Error('Solicitud demasiado grande.');
  return JSON.parse(raw);
}
async function digest(pass,salt){
  const key=await crypto.subtle.importKey('raw',te.encode(pass),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unb64(salt),iterations:ITERATIONS},key,256));
}
async function passwordEqual(pass,row){
  if(typeof pass!=='string'||pass.length<12||pass.length>128)return false;
  try{
    const bytes=await digest(pass,row.password_salt),target=unb64(row.password_hash);
    if(bytes.length!==target.length)return false;
    let diff=0;for(let i=0;i<bytes.length;i++)diff|=bytes[i]^target[i];
    return diff===0;
  }catch{return false}
}
async function schema(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_player_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, player_name TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, session_version INTEGER NOT NULL DEFAULT 1, opponent_name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare('CREATE TABLE IF NOT EXISTS cpz_member_attempts (login_key TEXT PRIMARY KEY, failures INTEGER NOT NULL, locked_until INTEGER NOT NULL)').run();
}
const usernameOK=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
const profile=row=>({name:row.player_name,username:row.username,opponent:row.opponent_name||null,group:null});
export async function onRequest({request,env,params}){
  const action=params.action;
  try{
    if(!env.LEAGUE_DB||typeof env.ADMIN_PASSWORD!=='string'||env.ADMIN_PASSWORD.length<12)return fail('Acceso todavía no configurado.',503);
    if(action==='session'&&request.method==='GET'){
      const row=await member(request,env);
      return respond({ok:true,authenticated:!!row,role:row?'player':null});
    }
    if(action==='community'&&request.method==='GET'){
      const row=await member(request,env);
      if(!row)return fail('Inicia sesión como jugador.',401);
      try{
        const [v,c]=await Promise.all([
          env.LEAGUE_DB.prepare('SELECT youtube_id AS youtubeId,title,player_one AS playerOne,player_two AS playerTwo,description FROM cpz_youtube_videos ORDER BY id DESC LIMIT 60').all(),
          env.LEAGUE_DB.prepare('SELECT channel_name AS channelName,player_name AS playerName,channel_url AS channelUrl FROM cpz_youtube_channels ORDER BY id DESC LIMIT 80').all()
        ]);
        return respond({ok:true,videos:v.results||[],channels:c.results||[]});
      }catch(err){
        // La biblioteca es opcional y puede no estar inicializada.
        return respond({ok:true,videos:[],channels:[]});
      }
    }
    if(action==='me'&&request.method==='GET'){
      const row=await member(request,env);
      if(!row)return fail('Inicia sesión como jugador.',401);
      return respond({ok:true,role:'player',profile:profile(row)});
    }
    if(!['login','logout','password'].includes(action))return fail('Ruta no encontrada.',404);
    if(request.method!=='POST')return fail('Método no permitido.',405);
    if(!originOK(request))return fail('Origen no autorizado.',403);
    if(action==='logout')return respond({ok:true,authenticated:false},200,clear);
    if(action==='password'){
      const row=await member(request,env);
      if(!row)return fail('Necesitas iniciar sesión como jugador.',401);
      const data=await body(request);
      if(typeof data?.newPassword!=='string'||data.newPassword.length<12||data.newPassword.length>128)return fail('La nueva contraseña debe tener entre 12 y 128 caracteres.');
      if(!await passwordEqual(data.currentPassword,row))return fail('La contraseña actual no coincide.',401);
      const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
      const hash=b64(await digest(data.newPassword,salt));
      const updated=await env.LEAGUE_DB.prepare('UPDATE cpz_player_accounts SET password_salt=?,password_hash=?,session_version=session_version+1 WHERE id=? AND session_version=? AND enabled=1').bind(salt,hash,row.id,row.session_version).run();
      if(updated.meta?.changes!==1)return fail('La cuenta ha cambiado. Vuelve a iniciar sesión.',409);
      return respond({ok:true,authenticated:true},200,await issue(row.id,row.session_version+1,env.ADMIN_PASSWORD));
    }
    // login
    const data=await body(request);
    const username=typeof data?.username==='string'?data.username.trim().toLowerCase():'';
    const password=data?.password;
    if(!usernameOK(username)||typeof password!=='string'||password.length<12||password.length>128)return fail('Usuario o contraseña incorrectos.',401);
    await schema(env.LEAGUE_DB);
    const ip=(request.headers.get('CF-Connecting-IP')||'unknown').slice(0,80);
    const key=username+'|'+ip;
    const attempted=await env.LEAGUE_DB.prepare('SELECT failures,locked_until FROM cpz_member_attempts WHERE login_key=?').bind(key).first();
    const now=Date.now();
    if(attempted?.locked_until>now)return fail('Demasiados intentos. Vuelve a intentarlo dentro de 15 minutos.',429);
    const row=await env.LEAGUE_DB.prepare('SELECT * FROM cpz_player_accounts WHERE username=? COLLATE NOCASE LIMIT 1').bind(username).first();
    const verified=row&&row.enabled===1&&await passwordEqual(password,row);
    if(!verified){
      const failures=(attempted?.locked_until>0&&attempted.locked_until<=now?0:attempted?.failures||0)+1;
      const lock=failures>=5?now+15*60*1000:0;
      await env.LEAGUE_DB.prepare('INSERT INTO cpz_member_attempts(login_key,failures,locked_until) VALUES(?,?,?) ON CONFLICT(login_key) DO UPDATE SET failures=excluded.failures,locked_until=excluded.locked_until').bind(key,failures,lock).run();
      return fail('Usuario o contraseña incorrectos.',401);
    }
    await env.LEAGUE_DB.prepare('DELETE FROM cpz_member_attempts WHERE login_key=?').bind(key).run();
    return respond({ok:true,authenticated:true,role:'player'},200,await issue(row.id,row.session_version,env.ADMIN_PASSWORD));
  }catch(error){
    console.error('CPZ member access',error?.name||'error');
    return fail('No se ha podido completar la operación de acceso.',500);
  }
}