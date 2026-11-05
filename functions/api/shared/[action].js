import {SHARED_COOKIE,ensureShared,hashPassword,newSalt,validPassword,sharedCookie,clearSharedCookie} from '../../shared-auth.js';
import {NOVEMBER_ROSTER,NOVEMBER_DOUBLES} from '../../../rosters.js';
const json=(body,status=200,cookie)=>{const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'});if(cookie){headers.append('Set-Cookie',cookie);if(cookie.startsWith('__Host-cpz_readonly=1.'))headers.append('Set-Cookie','__Host-leagueos_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0')}return new Response(JSON.stringify(body),{status,headers})};
const error=(message,status=400)=>json({ok:false,error:message},status);
const asJson=async request=>{if((request.headers.get('Content-Type')||'').split(';')[0]!=='application/json')throw Error('Tipo de solicitud incorrecto');const raw=await request.text();if(raw.length>5000)throw Error('Solicitud demasiado larga');return JSON.parse(raw)};
const sameOrigin=request=>{const origin=request.headers.get('Origin'),base=new URL(request.url).origin;if(origin)return origin===base;const site=request.headers.get('Sec-Fetch-Site');return site==='same-origin'||(!site&&request.headers.get('Referer')?.startsWith(base+'/'))};
const normalize=s=>String(s||'').trim().toUpperCase().replace(/^GRUPO\s+/,'');
async function summary(db){
 const singles=await db.prepare("SELECT r.played_at AS date,r.round_label AS round,r.group_label AS groupLabel,a.player_name AS player1,b.player_name AS player2,r.sets_json AS setsJson FROM cpz_match_results r JOIN cpz_player_accounts a ON a.id=r.player_one_id JOIN cpz_player_accounts b ON b.id=r.player_two_id WHERE r.played_at>='2026-11-01' AND r.played_at<'2026-12-01' ORDER BY r.played_at DESC LIMIT 300").all();
 let doubles=[];
 try{const data=await db.prepare("SELECT group_label AS groupLabel,pair_one AS pair1,pair_two AS pair2,played_at AS date,round_label AS round,sets_json AS setsJson FROM cpz_doubles_results WHERE played_at>='2026-11-01' AND played_at<'2026-12-01' ORDER BY played_at DESC LIMIT 200").all();doubles=data.results||[]}catch(err){if(!String(err.message).includes('no such table'))throw err}
 const individual=(singles.results||[]).flatMap(r=>{
   const group=normalize(r.groupLabel),members=NOVEMBER_ROSTER[group];
   if(!members||!members.includes(r.player1)||!members.includes(r.player2))return [];
   try{return [{groupLabel:group,player1:r.player1,player2:r.player2,date:r.date,round:r.round,sets:JSON.parse(r.setsJson)}]}catch{return []}
 });
 const doubleResults=doubles.flatMap(r=>{
   const pairs=NOVEMBER_DOUBLES[r.groupLabel],a=Number(r.pair1),b=Number(r.pair2);
   if(!pairs||!Number.isInteger(a)||!Number.isInteger(b)||!pairs[a]||!pairs[b]||a===b)return [];
   try{return [{groupLabel:r.groupLabel,player1:pairs[a].join(' / '),player2:pairs[b].join(' / '),date:r.date,round:r.round,sets:JSON.parse(r.setsJson)}]}catch{return []}
 });
 return {ok:true,individualGroups:NOVEMBER_ROSTER,doublesGroups:NOVEMBER_DOUBLES,individualResults:individual,doublesResults:doubleResults};
}
export async function onRequest({request,env,params}){
 const action=params.action,db=env.LEAGUE_DB;
 if(!db)return error('Base de datos no disponible',503);
 try{
  if(action==='config'){
   await ensureShared(db);
   if(request.method==='GET'){const status=await db.prepare('SELECT version,updated_at AS updatedAt FROM cpz_shared_access WHERE id=1').first();return json({ok:true,configured:!!status,updatedAt:status?.updatedAt||null})}
   if(request.method!=='POST'||!sameOrigin(request))return error('Solicitud no autorizada',403);
   const body=await asJson(request),password=typeof body?.password==='string'?body.password.trim():'';
   if(!validPassword(password))return error('La contraseña general debe tener entre 12 y 128 caracteres.');
   const salt=newSalt(),hash=await hashPassword(password,salt);
   await db.prepare("INSERT INTO cpz_shared_access (id,salt,hash,version) VALUES (1,?,?,1) ON CONFLICT(id) DO UPDATE SET salt=excluded.salt,hash=excluded.hash,version=cpz_shared_access.version+1,updated_at=CURRENT_TIMESTAMP").bind(salt,hash).run();
   return json({ok:true,message:'Contraseña general actualizada. Las sesiones anteriores quedan revocadas.'});
  }
  if(action==='login'){
   if(request.method!=='POST'||!sameOrigin(request))return error('Método no permitido',405);
   await ensureShared(db);
   await db.prepare("CREATE TABLE IF NOT EXISTS cpz_shared_login_attempts (iphash TEXT PRIMARY KEY,failures INTEGER NOT NULL DEFAULT 0,until_ms INTEGER NOT NULL DEFAULT 0)").run();
   const ip=request.headers.get('CF-Connecting-IP')||'unknown';
   const hashIp=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const attempts=await db.prepare('SELECT failures,until_ms FROM cpz_shared_login_attempts WHERE iphash=?').bind(hashIp).first();
   if(attempts&&attempts.failures>=5&&attempts.until_ms>Date.now())return error('Demasiados intentos. Inténtalo más tarde.',429);
   const body=await asJson(request);
   const state=await db.prepare('SELECT salt,hash,version FROM cpz_shared_access WHERE id=1').first();
   if(!state)return error('El administrador todavía no ha configurado el acceso de jugadores.',503);
   const pass=String(body.password||'');
   const derived=pass.length<=128?await hashPassword(pass,state.salt):'';
   const a=new TextEncoder().encode(derived),b=new TextEncoder().encode(state.hash);
   let diff=a.length===b.length?0:1;for(let i=0;i<Math.min(a.length,b.length);i++)diff|=a[i]^b[i];
   if(diff){const failures=(attempts?.until_ms>Date.now()?attempts.failures:0)+1;await db.prepare('INSERT INTO cpz_shared_login_attempts(iphash,failures,until_ms) VALUES (?,?,?) ON CONFLICT(iphash) DO UPDATE SET failures=excluded.failures,until_ms=excluded.until_ms').bind(hashIp,failures,Date.now()+15*60*1000).run();return error('Contraseña incorrecta.',401)}
   await db.prepare('DELETE FROM cpz_shared_login_attempts WHERE iphash=?').bind(hashIp).run();
   const cookie=await sharedCookie(env.ADMIN_PASSWORD,state.version);
   return json({ok:true,role:'read-only'},200,cookie);
  }
  if(action==='logout'){
   if(request.method!=='POST'||!sameOrigin(request))return error('Método no permitido',405);
   return json({ok:true},200,clearSharedCookie());
  }
  if(action==='session')return json({ok:true,authenticated:true,role:'read-only'});
  if(action==='data'){
   if(request.method!=='GET')return error('Solo consulta',405);
   return json(await summary(db));
  }
  return error('Ruta desconocida',404);
 }catch(err){console.error('shared access',err?.name||'error');return error('No se pudo procesar la solicitud.',500)}
}
