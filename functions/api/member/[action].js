// CPZ 2026/27 — inicio de sesión de jugadores y perfil de acceso reducido.
// Cookie independiente de administrador, con firma HMAC, versión y caducidad.
const SESSION='__Host-cpz_member';
const TTL=8*60*60;
// Production Cloudflare Workers cap PBKDF2 at 100k iterations.
const ITERATIONS=100000;
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
  const max=145000;
  if(Number(request.headers.get('Content-Length')||0)>max)throw Error('Solicitud demasiado grande.');
  const raw=await request.text();
  if(raw.length>max)throw Error('Solicitud demasiado grande.');
  const result=JSON.parse(raw);
  if(raw.length>2000&&result?.photoData===undefined)throw Error('Solicitud demasiado grande.');
  return result;
}
async function digest(pass,salt,secret){
  const pepperKey=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const peppered=await crypto.subtle.sign('HMAC',pepperKey,te.encode('CPZ_MEMBER_PWD_V1:'+pass));
  const key=await crypto.subtle.importKey('raw',peppered,'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unb64(salt),iterations:ITERATIONS},key,256));
}
async function passwordEqual(pass,row,secret){
  if(typeof pass!=='string'||pass.length<12||pass.length>128)return false;
  try{
    const bytes=await digest(pass,row.password_salt,secret),target=unb64(row.password_hash);
    if(bytes.length!==target.length)return false;
    let diff=0;for(let i=0;i<bytes.length;i++)diff|=bytes[i]^target[i];
    return diff===0;
  }catch{return false}
}
function instagramHandle(value){
  if(value===undefined||value===null||value==='')return '';
  if(typeof value!=='string'||value.length>150)return null;
  let v=value.trim();
  if(!v)return '';
  if(/^https?:\/\//i.test(v)){
    try{
      const u=new URL(v);
      if(u.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(u.hostname))return null;
      const parts=u.pathname.split('/').filter(Boolean);
      if(parts.length!==1)return null;
      v=parts[0];
    }catch{return null}
  }else if(v.startsWith('@'))v=v.slice(1);
  v=v.toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(v)&&!v.includes('..')&&!v.startsWith('.')&&!v.endsWith('.')?v:null;
}
function validateImage(data){
  if(data===undefined)return undefined;
  if(data==='')return '';
  if(typeof data!=='string'||data.length>115000)return null;
  const m=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if(!m)return null;
  try{
    const raw=atob(m[1]);
    if(raw.length<150||raw.length>85000)return null;
    if(raw.charCodeAt(0)!==255||raw.charCodeAt(1)!==216||raw.charCodeAt(2)!==255||
       raw.charCodeAt(raw.length-2)!==255||raw.charCodeAt(raw.length-1)!==217)return null;
    return data;
  }catch{return null}
}
function imageResponse(data){
  const valid=validateImage(data);
  if(!valid||typeof valid!=='string')return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});
  const bytes=Uint8Array.from(atob(valid.slice('data:image/jpeg;base64,'.length)),c=>c.charCodeAt(0));
  return new Response(bytes,{headers:{
    'Content-Type':'image/jpeg','Cache-Control':'private, no-store, max-age=0',
    'X-Content-Type-Options':'nosniff','Content-Disposition':'inline',
    'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
  }});
}
async function contactSchema(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_player_contacts (account_id INTEGER PRIMARY KEY REFERENCES cpz_player_accounts(id) ON DELETE CASCADE, whatsapp_phone TEXT NOT NULL DEFAULT '', share_with_opponent INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_player_profiles (account_id INTEGER PRIMARY KEY REFERENCES cpz_player_accounts(id) ON DELETE CASCADE, email TEXT NOT NULL DEFAULT '', group_label TEXT NOT NULL DEFAULT '', preferred_name TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_player_media (account_id INTEGER PRIMARY KEY REFERENCES cpz_player_accounts(id) ON DELETE CASCADE, instagram TEXT NOT NULL DEFAULT '', share_social INTEGER NOT NULL DEFAULT 0, photo_data TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_privacy_events (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, purpose TEXT NOT NULL, granted INTEGER NOT NULL, actor TEXT NOT NULL, recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_player_privacy_ack (account_id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, acknowledged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_legal_settings (id INTEGER PRIMARY KEY CHECK (id=1), responsible_name TEXT NOT NULL DEFAULT '', contact_email TEXT NOT NULL DEFAULT '', postal_address TEXT NOT NULL DEFAULT '', retention_note TEXT NOT NULL DEFAULT '', legal_basis TEXT NOT NULL DEFAULT '', approved INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
function cleanEmail(v){
  if(typeof v!=='string'||v.length>160)return null;
  const email=v.trim().toLowerCase();
  return !email||(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)&&email.length<=160)?email:null;
}
function cleanPreferredName(v){
  if(typeof v!=='string')return null;
  const name=v.trim();
  return name.length<=70&&!/[<>\u0000-\u001f]/.test(name)?name:null;
}
function normalizedPhone(value){
  if(value===null||value===undefined||value==='')return '';
  if(typeof value!=='string'||value.length>45)return null;
  let raw=value.trim().replace(/[\s().-]/g,'');
  if(raw.startsWith('00'))raw='+'+raw.slice(2);
  if(/^[67]\d{8}$/.test(raw))raw='+34'+raw;
  else if(/^34[67]\d{8}$/.test(raw))raw='+'+raw;
  return /^\+[1-9]\d{7,14}$/.test(raw)?raw:null;
}
async function schema(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_player_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, player_name TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, session_version INTEGER NOT NULL DEFAULT 1, opponent_name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare('CREATE TABLE IF NOT EXISTS cpz_member_attempts (login_key TEXT PRIMARY KEY, failures INTEGER NOT NULL, locked_until INTEGER NOT NULL)').run();
  await contactSchema(db);
}
const usernameOK=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
async function profile(row,db){
  await contactSchema(db);
  const own=await db.prepare('SELECT whatsapp_phone,share_with_opponent FROM cpz_player_contacts WHERE account_id=?').bind(row.id).first();
  const details=await db.prepare('SELECT email,group_label,preferred_name FROM cpz_player_profiles WHERE account_id=?').bind(row.id).first();
  const social=await db.prepare("SELECT instagram,share_social,CASE WHEN LENGTH(photo_data)>0 THEN 1 ELSE 0 END AS has_photo FROM cpz_player_media WHERE account_id=?").bind(row.id).first();
  const legal=await db.prepare('SELECT revision FROM cpz_legal_settings WHERE id=1 AND approved=1').first();
  const acknowledgement=await db.prepare('SELECT revision FROM cpz_player_privacy_ack WHERE account_id=?').bind(row.id).first();
  const opponentSocial=row.opponent_name
    ?await db.prepare("SELECT m.instagram AS instagram, CASE WHEN LENGTH(m.photo_data)>0 THEN 1 ELSE 0 END AS has_photo FROM cpz_player_accounts a JOIN cpz_player_media m ON m.account_id=a.id WHERE a.player_name=? AND a.opponent_name=? AND a.enabled=1 AND m.share_social=1 LIMIT 1")
      .bind(row.opponent_name,row.player_name).first()
    :null;
  // La agenda no es pública: solo se entrega el número del rival efectivamente asignado,
  // si su cuenta sigue activa, el emparejamiento es recíproco y ha autorizado compartirlo.
  const opponent=row.opponent_name
    ?await db.prepare("SELECT c.whatsapp_phone AS phone FROM cpz_player_accounts a JOIN cpz_player_contacts c ON c.account_id=a.id WHERE a.player_name=? AND a.opponent_name=? AND a.enabled=1 AND c.share_with_opponent=1 AND c.whatsapp_phone<>'' LIMIT 1")
      .bind(row.opponent_name,row.player_name).first()
    :null;
  return {
    name:row.player_name,username:row.username,opponent:row.opponent_name||null,
    group:details?.group_label||null,email:details?.email||'',preferredName:details?.preferred_name||'',
    whatsappPhone:own?.whatsapp_phone||'',
    shareWithOpponent:own?.share_with_opponent===1,
    opponentWhatsapp:opponent?.phone||null,
    instagram:social?.instagram||'',shareSocial:social?.share_social===1,
    hasPhoto:social?.has_photo===1,
    opponentInstagram:opponentSocial?.instagram||null,
    opponentHasPhoto:opponentSocial?.has_photo===1,
    legalApproved:!!legal,legalRevision:legal?.revision||0,
    privacyNeedsAcknowledgement:!!legal&&(!acknowledgement||acknowledgement.revision<legal.revision)
  };
}
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
    if(action==='results'&&request.method==='GET'){
      const row=await member(request,env);
      if(!row)return fail('Inicia sesión como jugador.',401);
      try{
        const data=await env.LEAGUE_DB.prepare(
          "SELECT r.played_at AS date,r.round_label AS round,r.group_label AS groupLabel,a.player_name AS player1,b.player_name AS player2,r.sets_json AS setsJson,r.winner_id AS winnerId FROM cpz_match_results r JOIN cpz_player_accounts a ON a.id=r.player_one_id JOIN cpz_player_accounts b ON b.id=r.player_two_id WHERE r.player_one_id=? OR r.player_two_id=? ORDER BY r.played_at DESC,r.id DESC LIMIT 150"
        ).bind(row.id,row.id).all();
        return respond({ok:true,results:(data.results||[]).map(r=>({
          date:r.date,round:r.round,groupLabel:r.groupLabel,player1:r.player1,player2:r.player2,
          sets:JSON.parse(r.setsJson),winner:r.winnerId===row.id?'Yo':'Rival'
        }))});
      }catch(e){
        return respond({ok:true,results:[]});
      }
    }
    if(action==='photo'&&request.method==='GET'){
      const row=await member(request,env);
      if(!row)return fail('Acceso exclusivo de jugadores.',401);
      await contactSchema(env.LEAGUE_DB);
      const other=new URL(request.url).searchParams.get('opponent')==='1';
      if(other){
        if(!row.opponent_name)return fail('No hay rival asignado.',404);
        const result=await env.LEAGUE_DB.prepare(
          "SELECT m.photo_data FROM cpz_player_accounts a JOIN cpz_player_media m ON m.account_id=a.id WHERE a.player_name=? AND a.opponent_name=? AND a.enabled=1 AND m.share_social=1 LIMIT 1"
        ).bind(row.opponent_name,row.player_name).first();
        return imageResponse(result?.photo_data);
      }
      const result=await env.LEAGUE_DB.prepare("SELECT photo_data FROM cpz_player_media WHERE account_id=?").bind(row.id).first();
      return imageResponse(result?.photo_data);
    }
    if(action==='me'&&request.method==='GET'){
      const row=await member(request,env);
      if(!row)return fail('Inicia sesión como jugador.',401);
      return respond({ok:true,role:'player',profile:await profile(row,env.LEAGUE_DB)});
    }
    if(!['login','logout','password','contact','details','media','acknowledge'].includes(action))return fail('Ruta no encontrada.',404);
    if(request.method!=='POST')return fail('Método no permitido.',405);
    if(!originOK(request))return fail('Origen no autorizado.',403);
    if(action==='logout')return respond({ok:true,authenticated:false},200,clear);
    if(action==='acknowledge'){
      const row=await member(request,env);
      if(!row)return fail('Necesitas iniciar sesión como jugador.',401);
      const data=await body(request);
      if(data?.confirmRead!==true)return fail('Marca la casilla si has leído la información de privacidad.');
      await contactSchema(env.LEAGUE_DB);
      const settings=await env.LEAGUE_DB.prepare('SELECT revision FROM cpz_legal_settings WHERE id=1 AND approved=1').first();
      if(!settings)return fail('El aviso de privacidad aún está pendiente de aprobación del organizador.',409);
      await env.LEAGUE_DB.batch([
        env.LEAGUE_DB.prepare('INSERT INTO cpz_player_privacy_ack(account_id,revision,acknowledged_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(account_id) DO UPDATE SET revision=excluded.revision,acknowledged_at=CURRENT_TIMESTAMP').bind(row.id,settings.revision),
        env.LEAGUE_DB.prepare("INSERT INTO cpz_privacy_events(account_id,purpose,granted,actor) VALUES(?,'privacy_notice_read',1,'player')").bind(row.id)
      ]);
      return respond({ok:true,profile:await profile(row,env.LEAGUE_DB)});
    }
    if(action==='media'){
      const row=await member(request,env);
      if(!row)return fail('Necesitas iniciar sesión como jugador.',401);
      const data=await body(request);
      const handle=instagramHandle(data?.instagram),photo=validateImage(data?.photoData);
      if(handle===null||photo===null||typeof data?.shareSocial!=='boolean')
        return fail('Instagram o fotografía inválidos. Usa una foto JPEG comprimida menor de 85 KB.');
      await contactSchema(env.LEAGUE_DB);
      const mediaUpdate=photo===undefined
        ?env.LEAGUE_DB.prepare("INSERT INTO cpz_player_media(account_id,instagram,share_social) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET instagram=excluded.instagram,share_social=excluded.share_social,updated_at=CURRENT_TIMESTAMP").bind(row.id,handle,data.shareSocial?1:0)
        :env.LEAGUE_DB.prepare("INSERT INTO cpz_player_media(account_id,instagram,share_social,photo_data) VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET instagram=excluded.instagram,share_social=excluded.share_social,photo_data=excluded.photo_data,updated_at=CURRENT_TIMESTAMP").bind(row.id,handle,data.shareSocial?1:0,photo);
      await env.LEAGUE_DB.batch([
        mediaUpdate,
        env.LEAGUE_DB.prepare("INSERT INTO cpz_privacy_events(account_id,purpose,granted,actor) VALUES(?,'photo_instagram_opponent',?,'player')").bind(row.id,data.shareSocial?1:0)
      ]);
      return respond({ok:true,profile:await profile(row,env.LEAGUE_DB)});
    }
    if(action==='details'){
      const row=await member(request,env);
      if(!row)return fail('Necesitas iniciar sesión como jugador.',401);
      const data=await body(request);
      const email=cleanEmail(data?.email),name=cleanPreferredName(data?.preferredName);
      if(email===null||name===null)return fail('Revisa el correo electrónico o el nombre preferido.');
      await contactSchema(env.LEAGUE_DB);
      // Nombre oficial, usuario, rivales y grupos siguen bajo control del administrador.
      await env.LEAGUE_DB.prepare("INSERT INTO cpz_player_profiles (account_id,email,preferred_name,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(account_id) DO UPDATE SET email=excluded.email,preferred_name=excluded.preferred_name,updated_at=CURRENT_TIMESTAMP")
        .bind(row.id,email,name).run();
      return respond({ok:true,profile:await profile(row,env.LEAGUE_DB)});
    }
    if(action==='contact'){
      const row=await member(request,env);
      if(!row)return fail('Necesitas iniciar sesión como jugador.',401);
      const data=await body(request);
      const phone=normalizedPhone(data?.whatsappPhone);
      const shared=data?.shareWithOpponent;
      if(phone===null||typeof shared!=='boolean'||(shared&&!phone))
        return fail('Número de WhatsApp inválido o falta confirmar la autorización para compartirlo.');
      await contactSchema(env.LEAGUE_DB);
      await env.LEAGUE_DB.batch([
        env.LEAGUE_DB.prepare('INSERT INTO cpz_player_contacts (account_id,whatsapp_phone,share_with_opponent,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(account_id) DO UPDATE SET whatsapp_phone=excluded.whatsapp_phone,share_with_opponent=excluded.share_with_opponent,updated_at=CURRENT_TIMESTAMP').bind(row.id,phone,shared?1:0),
        env.LEAGUE_DB.prepare("INSERT INTO cpz_privacy_events(account_id,purpose,granted,actor) VALUES(?,'whatsapp_opponent',?,'player')").bind(row.id,shared?1:0)
      ]);
      return respond({ok:true,profile:await profile(row,env.LEAGUE_DB)});
    }
    if(action==='password'){
      const row=await member(request,env);
      if(!row)return fail('Necesitas iniciar sesión como jugador.',401);
      const data=await body(request);
      if(typeof data?.newPassword!=='string'||data.newPassword.length<12||data.newPassword.length>128)return fail('La nueva contraseña debe tener entre 12 y 128 caracteres.');
      if(!await passwordEqual(data.currentPassword,row,env.ADMIN_PASSWORD))return fail('La contraseña actual no coincide.',401);
      const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
      const hash=b64(await digest(data.newPassword,salt,env.ADMIN_PASSWORD));
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
    const verified=row&&row.enabled===1&&await passwordEqual(password,row,env.ADMIN_PASSWORD);
    if(!verified){
      const failures=(attempted?.locked_until>0&&attempted.locked_until<=now?0:attempted?.failures||0)+1;
      const lock=failures>=5?now+15*60*1000:0;
      await env.LEAGUE_DB.prepare('INSERT INTO cpz_member_attempts(login_key,failures,locked_until) VALUES(?,?,?) ON CONFLICT(login_key) DO UPDATE SET failures=excluded.failures,locked_until=excluded.locked_until').bind(key,failures,lock).run();
      return fail('Usuario o contraseña incorrectos.',401);
    }
    await env.LEAGUE_DB.prepare('DELETE FROM cpz_member_attempts WHERE login_key=?').bind(key).run();
    const result=respond({ok:true,authenticated:true,role:'player'},200,await issue(row.id,row.session_version,env.ADMIN_PASSWORD));
    // When switching from an administrator session to a player's account,
    // remove the old admin cookie. Otherwise middleware prioritizes admin and
    // redirects back to the admin panel after the player signs in.
    result.headers.append('Set-Cookie','__Host-leagueos_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    return result;
  }catch(error){
    console.error('CPZ member access',error?.name||'error');
    return fail('No se ha podido completar la operación de acceso.',500);
  }
}