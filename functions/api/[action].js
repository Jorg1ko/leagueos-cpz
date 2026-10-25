// LeagueOS CPZ: acceso de administrador y resultados en Cloudflare D1.
// El servidor es la única autoridad para escribir resultados.
// Requiere LEAGUE_DB (D1) y ADMIN_PASSWORD (secreto cifrado de Pages).
const SESSION = '__Host-leagueos_admin';
const SESSION_AGE = 8 * 60 * 60;
const te = new TextEncoder();
const combinations = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
const initial = () => ({
  divisions: Array.from({length:10}, (_,d)=>Array.from({length:4},(_,p)=>4*d+p+1)),
  results:{}, month:1, history:[]
});

function response(data, code=200, cookie) {
  const h = new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});
  if(cookie) h.set('Set-Cookie',cookie);
  return new Response(JSON.stringify(data),{status:code,headers:h});
}
function error(message, status=400){return response({ok:false,error:message},status)}
function ready(env){return !!(env.LEAGUE_DB && typeof env.ADMIN_PASSWORD==='string' && env.ADMIN_PASSWORD.length>=12)}
function sameOrigin(request){return request.headers.get('Origin')===new URL(request.url).origin && (request.headers.get('Content-Type')||'').startsWith('application/json')}
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
async function stateRow(db){
  await db.prepare('CREATE TABLE IF NOT EXISTS league_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)').run();
  await db.prepare('INSERT OR IGNORE INTO league_state (id,payload,revision) VALUES (1,?,0)').bind(JSON.stringify(initial())).run();
  const row=await db.prepare('SELECT payload,revision FROM league_state WHERE id=1').first();
  return {state:JSON.parse(row.payload),revision:row.revision};
}
async function loginAttempts(db,ip){
  await db.prepare('CREATE TABLE IF NOT EXISTS login_limits (ip TEXT PRIMARY KEY, failures INTEGER NOT NULL, locked_until INTEGER NOT NULL)').run();
  return await db.prepare('SELECT failures,locked_until FROM login_limits WHERE ip=?').bind(ip).first();
}
function standings(state,d){
  const rows=state.divisions[d].map(id=>({id,p:0,w:0}));
  for(let i=0;i<6;i++){
    const [a,b]=combinations[i];
    const score=state.results[d+'-'+i];
    if(!score)continue;
    const winner=score[0]>score[1]?state.divisions[d][a]:state.divisions[d][b];
    const r=rows.find(x=>x.id===winner);r.p+=3;r.w++;
  }
  return rows.sort((a,b)=>b.p-a.p||b.w-a.w||a.id-b.id).map(x=>x.id);
}
async function mutate(env,body,action){
  if(!Number.isSafeInteger(body.revision)||body.revision<0)return error('Revisión inválida.',400);
  const {state,revision}=await stateRow(env.LEAGUE_DB);
  if(revision!==body.revision)return error('La liga cambió en otra sesión. Actualiza para continuar.',409);
  if(action==='save'){
    const {group,match,scoreA,scoreB,period}=body;
    if(period!==state.month||!Number.isInteger(group)||group<0||group>=10||!Number.isInteger(match)||match<0||match>=6
      ||!Number.isInteger(scoreA)||!Number.isInteger(scoreB)||scoreA<0||scoreB<0||scoreA>99||scoreB>99||scoreA===scoreB)
      return error('Marcador inválido o periodo desactualizado.');
    state.results[group+'-'+match]=[scoreA,scoreB];
  }else if(action==='advance'){
    if(Object.keys(state.results).length!==60)return error('Deben completarse los 60 partidos antes de cerrar el periodo.');
    const ranked=state.divisions.map((_,d)=>standings(state,d));
    for(let d=0;d<9;d++){
      const loser=ranked[d][3],promoted=ranked[d+1][0];
      ranked[d][3]=promoted;ranked[d+1][0]=loser;
    }
    state.history.push({month:state.month,closedAt:new Date().toISOString()});
    state.divisions=ranked;state.results={};state.month++;
  }else if(action==='reset'){
    Object.assign(state,initial());
  }else if(action==='simulate'){
    if(env.LEAGUE_DEMO!=='true')return error('La simulación está desactivada para proteger los resultados reales.',403);
    for(let d=0;d<10;d++)for(let i=0;i<6;i++)if(!state.results[d+'-'+i])
      state.results[d+'-'+i]=i%2===0?[11,7]:[7,11];
  }else return error('Operación no encontrada.',404);
  const payload=JSON.stringify(state);
  const result=await env.LEAGUE_DB.prepare('UPDATE league_state SET payload=?,revision=revision+1 WHERE id=1 AND revision=?').bind(payload,revision).run();
  if(result.meta?.changes!==1)return error('Los resultados han cambiado. Vuelve a cargar.',409);
  return response({ok:true,ready:true,state,revision:revision+1});
}
export async function onRequest({request,env,params}){
  const action=params.action;
  const method=request.method;
  try{
    if(action==='state'&&method==='GET'){
      // Defensa en profundidad: los datos no se entregan fuera de una sesión de administrador,
      // incluso si se desactiva accidentalmente el middleware de la web.
      if(!ready(env)||!await authenticated(request,env.ADMIN_PASSWORD)){
        return error('Acceso privado. Inicia sesión como administrador.',401);
      }
      const data=await stateRow(env.LEAGUE_DB);
      return response({...data,ready:true});
    }
    if(action==='session'&&method==='GET'){
      return response({ready:ready(env),authenticated:ready(env)&&await authenticated(request,env.ADMIN_PASSWORD),demo:env.LEAGUE_DEMO==='true',setup:{databaseConnected:!!env.LEAGUE_DB,adminPasswordConfigured:typeof env.ADMIN_PASSWORD==='string'&&env.ADMIN_PASSWORD.length>=12}});
    }
    if(!['login','logout','save','advance','reset','simulate'].includes(action))return error('Ruta no encontrada.',404);
    if(method!=='POST')return error('Método no permitido.',405);
    if(!sameOrigin(request))return error('Origen o formato de solicitud no permitido.',403);
    if(action==='logout')return response({ok:true,authenticated:false},200,SESSION+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    if(!ready(env))return error('La administración aún no está configurada en Cloudflare.',503);
    if(action==='login'){
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
    }
    if(!await authenticated(request,env.ADMIN_PASSWORD))return error('Necesitas iniciar sesión como administrador.',401);
    const body=await bodyJSON(request);
    return await mutate(env,body,action);
  }catch(e){
    console.error('LeagueOS API error',e?.name||'runtime');
    return error('No se ha podido completar la operación. Comprueba la configuración.',500);
  }
}