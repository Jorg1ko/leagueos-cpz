// LeagueOS CPZ: acceso de administrador y resultados en Cloudflare D1.
// El servidor es la única autoridad para escribir resultados.
// Requiere LEAGUE_DB (D1) y ADMIN_PASSWORD (secreto cifrado de Pages).
const SESSION = '__Host-leagueos_admin';
const SESSION_AGE = 8 * 60 * 60;
const te = new TextEncoder();

function response(data, code=200, cookie) {
  const h = new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});
  if(cookie) h.set('Set-Cookie',cookie);
  return new Response(JSON.stringify(data),{status:code,headers:h});
}
function error(message, status=400){return response({ok:false,error:message},status)}
function ready(env){return !!(env.LEAGUE_DB && typeof env.ADMIN_PASSWORD==='string' && env.ADMIN_PASSWORD.length>=12)}
function sameOrigin(request){
  // Los navegadores integrados pueden omitir Origin en POST del mismo sitio.
  // Solo se permite JSON y evidencia del mismo origen; los cross-site quedan bloqueados.
  const ct=(request.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
  if(ct!=='application/json')return false;
  const url=new URL(request.url),origin=request.headers.get('Origin');
  if(origin)return origin===url.origin;
  const fetchSite=request.headers.get('Sec-Fetch-Site');
  if(fetchSite)return fetchSite==='same-origin';
  try{return new URL(request.headers.get('Referer')).origin===url.origin}catch(e){return false}
}
async function bodyJSON(request){
  if(Number(request.headers.get('Content-Length')||0)>2500) throw Error('Solicitud demasiado grande.');
  const raw=await request.text();
  if(raw.length>2500) throw Error('Solicitud demasiado grande.');
  return JSON.parse(raw);
}
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decode64(str){const raw=atob(str.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((str.length+3)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function signer(secret){return crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function issueSession(secret){
  const expires=Date.now()+SESSION_AGE*1000;
  const nonce=base64url(crypto.getRandomValues(new Uint8Array(16)));
  const data='1.'+expires+'.'+nonce;
  const signature=base64url(new Uint8Array(await crypto.subtle.sign('HMAC',await signer(secret),te.encode(data))));
  return data+'.'+signature;
}
async function authenticated(request,secret){
  if(typeof secret!=='string'||secret.length<12)return false;
  const cookie=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(SESSION+'='));
  if(!cookie)return false;
  const token=cookie.slice(SESSION.length+1);
  const parts=token.split('.');
  if(parts.length!==4||parts[0]!=='1'||!/^[0-9]{13}$/.test(parts[1]))return false;
  const expires=Number(parts[1]);
  if(expires<Date.now()||expires>Date.now()+SESSION_AGE*1000)return false;
  try{return await crypto.subtle.verify('HMAC',await signer(secret),decode64(parts[3]),te.encode(parts.slice(0,3).join('.')))}
  catch{return false}
}
async function passwordEqual(a,b){
  if(typeof a!=='string'||a.length<12||a.length>256)return false;
  const digest=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(v)));
  const [x,y]=await Promise.all([digest(a),digest(b)]);
  let diff=0;
  for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
  return diff===0;
}

async function loginAttempts(db,ip){
  // Esta tabla controla los intentos fallidos del administrador en D1.
  // Se crea si todavía no existe, sin borrar ni modificar registros anteriores.
  await db.prepare("CREATE TABLE IF NOT EXISTS login_limits (ip TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0)").run();
  return await db.prepare('SELECT failures, locked_until FROM login_limits WHERE ip=?').bind(ip).first();
}

export async function onRequest({request,env,params}){
  const action=params.action;
  const method=request.method;
  try{
    // La antigua simulación de 40 jugadores y resultados ha sido retirada.
    if(['state','save','advance','reset','simulate'].includes(action))
      return error('La simulación anterior se ha retirado. Utiliza las nuevas secciones de Jugadores y Resultados Excel.',410);
    if(action==='session'&&method==='GET'){
      return response({
        ready:ready(env),
        authenticated:ready(env)&&await authenticated(request,env.ADMIN_PASSWORD),
        demo:false,
        setup:{databaseConnected:!!env.LEAGUE_DB,adminPasswordConfigured:typeof env.ADMIN_PASSWORD==='string'&&env.ADMIN_PASSWORD.length>=12}
      });
    }
    if(!['login','logout'].includes(action))return error('Ruta no encontrada.',404);
    if(method!=='POST')return error('Método no permitido.',405);
    if(!sameOrigin(request))return error('Origen o formato de solicitud no permitido.',403);
    if(action==='logout')return response({ok:true,authenticated:false},200,SESSION+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    if(!ready(env))return error('La administración todavía no está configurada.',503);
    const ip=(request.headers.get('CF-Connecting-IP')||'unknown').slice(0,90);
    const previous=await loginAttempts(env.LEAGUE_DB,ip);
    const now=Date.now();
    if(previous?.locked_until>now)return error('Demasiados intentos. Inténtalo más tarde.',429);
    const body=await bodyJSON(request);
    if(!await passwordEqual(body.password,env.ADMIN_PASSWORD)){
      const failures=((previous&&previous.locked_until>0&&previous.locked_until<=now)?0:(previous?.failures||0))+1;
      const lock=failures>=5?now+15*60*1000:0;
      await env.LEAGUE_DB.prepare('INSERT INTO login_limits (ip,failures,locked_until) VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET failures=excluded.failures,locked_until=excluded.locked_until').bind(ip,failures,lock).run();
      return error('Credenciales incorrectas.',401);
    }
    await env.LEAGUE_DB.prepare('DELETE FROM login_limits WHERE ip=?').bind(ip).run();
    const token=await issueSession(env.ADMIN_PASSWORD);
    return response({ok:true,authenticated:true},200,SESSION+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+SESSION_AGE);
  }catch(e){
    console.error('CPZ authentication error',e?.name||'runtime');
    return error('No se ha podido completar la operación.',500);
  }
}
