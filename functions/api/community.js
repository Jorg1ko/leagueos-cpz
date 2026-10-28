// Ranking Individual CPZ 2026/27: biblioteca privada de canales y vídeos.
// Los enlaces se almacenan en D1; nunca se suben archivos de vídeo.
// Hasta habilitar cuentas individuales, solo el administrador puede publicar o retirar contenido.
const COOKIE_NAME = '__Host-leagueos_admin';
const SESSION_AGE = 8*60*60;
const encoder = new TextEncoder();

function json(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'private, no-store, max-age=0',
    'X-Content-Type-Options':'nosniff'
  }});
}
function fail(message,status=400){return json({ok:false,error:message},status)}

async function isAdmin(request,secret){
  if(typeof secret!=='string'||secret.length<12)return false;
  const cookie=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim())
    .find(v=>v.startsWith(COOKIE_NAME+'='));
  if(!cookie)return false;
  const parts=cookie.slice(COOKIE_NAME.length+1).split('.');
  if(parts.length!==4||parts[0]!=='1'||!/^[0-9]{13}$/.test(parts[1]))return false;
  const expires=Number(parts[1]);
  if(expires<Date.now()||expires>Date.now()+SESSION_AGE*1000)return false;
  try{
    const raw=parts[3].replace(/-/g,'+').replace(/_/g,'/');
    const padded=raw+'='.repeat((4-raw.length%4)%4);
    const bytes=Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey('raw',encoder.encode(secret),
      {name:'HMAC',hash:'SHA-256'},false,['verify']);
    return crypto.subtle.verify('HMAC',key,bytes,encoder.encode(parts.slice(0,3).join('.')));
  }catch(e){return false}
}
function sameOrigin(request){
  if((request.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return false;
  const base=new URL(request.url).origin;
  const origin=request.headers.get('Origin');
  if(origin)return origin===base;
  const site=request.headers.get('Sec-Fetch-Site');
  if(site)return site==='same-origin';
  try{return new URL(request.headers.get('Referer')).origin===base}catch(e){return false}
}
async function readBody(request){
  if(Number(request.headers.get('Content-Length')||0)>5000)throw Error('Solicitud demasiado grande');
  const data=await request.text();
  if(data.length>5000)throw Error('Solicitud demasiado grande');
  return JSON.parse(data);
}
function stringValue(value,max){
  return typeof value==='string' ? value.trim().slice(0,max+1) : '';
}
function plainName(value,max=90){
  const name=stringValue(value,max);
  if(name.length>max||/[<>\u0000-\u001f]/.test(name))return null;
  return name;
}
function youtubeId(value){
  const raw=stringValue(value,400);
  if(raw.length>400)return null;
  let url;
  try{url=new URL(raw)}catch(e){return null}
  if(url.protocol!=='https:')return null;
  const host=url.hostname.toLowerCase();
  let id='';
  if(host==='youtu.be')id=url.pathname.split('/')[1]||'';
  else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host)){
    const parts=url.pathname.split('/').filter(Boolean);
    if(parts.length===1&&parts[0]==='watch')id=url.searchParams.get('v')||'';
    else if(parts.length===2&&['embed','shorts','live','v'].includes(parts[0]))id=parts[1];
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(id)?id:null;
}
function youtubeChannel(value){
  const raw=stringValue(value,400);
  if(raw.length>400)return null;
  let url;
  try{url=new URL(raw)}catch(e){return null}
  if(url.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname.toLowerCase()))return null;
  const parts=url.pathname.split('/').filter(Boolean);
  if(!parts.length)return null;
  let slug='';
  if(/^@[a-zA-Z0-9_.-]{3,50}$/.test(parts[0]))slug='/'+parts[0];
  else if(parts.length>=2&&parts[0]==='channel'&&/^UC[a-zA-Z0-9_-]{15,50}$/.test(parts[1]))slug='/channel/'+parts[1];
  else if(parts.length>=2&&['c','user'].includes(parts[0])&&/^[a-zA-Z0-9_-]{2,80}$/.test(parts[1]))slug='/'+parts[0]+'/'+parts[1];
  return slug?'https://www.youtube.com'+slug:null;
}
async function createTables(db){
  await db.prepare('CREATE TABLE IF NOT EXISTS cpz_youtube_channels (id INTEGER PRIMARY KEY AUTOINCREMENT, player_name TEXT NOT NULL, channel_name TEXT NOT NULL, channel_url TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS cpz_youtube_videos (id INTEGER PRIMARY KEY AUTOINCREMENT, youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, player_one TEXT NOT NULL DEFAULT \'\', player_two TEXT NOT NULL DEFAULT \'\', description TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
}
async function records(db){
  const [channels,videos]=await Promise.all([
    db.prepare('SELECT id, player_name AS playerName, channel_name AS channelName, channel_url AS channelUrl, created_at AS createdAt FROM cpz_youtube_channels ORDER BY id DESC LIMIT 250').all(),
    db.prepare('SELECT id, youtube_id AS youtubeId, title, player_one AS playerOne, player_two AS playerTwo, description, created_at AS createdAt FROM cpz_youtube_videos ORDER BY id DESC LIMIT 250').all()
  ]);
  return {ok:true,channels:channels.results||[],videos:videos.results||[]};
}

export async function onRequest({request,env}){
  try{
    // Independiente de la protección de Pages: no exponer nunca los registros sin sesión.
    if(!env.LEAGUE_DB||!(await isAdmin(request,env.ADMIN_PASSWORD)))
      return fail('Acceso privado. Inicia sesión como administrador.',401);
    if(!['GET','POST'].includes(request.method))return fail('Método no permitido.',405);
    if(request.method==='POST'&&!sameOrigin(request))return fail('Solicitud no autorizada.',403);
    await createTables(env.LEAGUE_DB);
    if(request.method==='GET')return json(await records(env.LEAGUE_DB));
    const body=await readBody(request);
    if(!body||typeof body!=='object')return fail('Solicitud inválida.');
    if(['addChannel','addVideo'].includes(body.action)&&body.consentConfirmed!==true)
      return fail('Confirma que tienes permiso para publicar este contenido.');
    if(body.action==='addChannel'){
      const name=plainName(body.playerName);
      const label=plainName(body.channelName,100);
      const url=youtubeChannel(body.channelUrl);
      if(!name||name.length<2||!label||label.length<2||!url)
        return fail('Indica un jugador, un nombre de canal y un enlace válido a un canal de YouTube.');
      const result=await env.LEAGUE_DB.prepare('SELECT id FROM cpz_youtube_channels WHERE player_name=? OR channel_url=? LIMIT 1')
        .bind(name,url).first();
      if(result)return fail('Ya existe un canal para ese jugador o ese enlace.');
      await env.LEAGUE_DB.prepare('INSERT INTO cpz_youtube_channels (player_name,channel_name,channel_url) VALUES(?,?,?)')
        .bind(name,label,url).run();
    }else if(body.action==='addVideo'){
      const id=youtubeId(body.url);
      const title=plainName(body.title,150);
      const one=plainName(body.playerOne);
      const two=plainName(body.playerTwo);
      const description=plainName(body.description,400);
      if(!id||!title||title.length<3||one===null||two===null||description===null)
        return fail('Completa un título de al menos 3 caracteres y pega un vídeo válido de YouTube.');
      if(one&&two&&one===two)return fail('Selecciona jugadores distintos.');
      try{
        await env.LEAGUE_DB.prepare('INSERT INTO cpz_youtube_videos (youtube_id,title,player_one,player_two,description) VALUES(?,?,?,?,?)')
          .bind(id,title,one,two,description).run();
      }catch(e){
        if(/UNIQUE|constraint/i.test(String(e)))return fail('Ese vídeo ya está añadido.');
        throw e;
      }
    }else if(body.action==='removeChannel'||body.action==='removeVideo'){
      const id=Number(body.id);
      if(!Number.isSafeInteger(id)||id<1)return fail('Identificador inválido.');
      const table=body.action==='removeChannel'?'cpz_youtube_channels':'cpz_youtube_videos';
      await env.LEAGUE_DB.prepare('DELETE FROM '+table+' WHERE id=?').bind(id).run();
    }else return fail('Operación no reconocida.',404);
    return json(await records(env.LEAGUE_DB));
  }catch(e){
    console.error('CPZ community storage error',e?.name||'unknown');
    return fail('No se ha podido actualizar la comunidad. Comprueba la conexión e inténtalo otra vez.',500);
  }
}
