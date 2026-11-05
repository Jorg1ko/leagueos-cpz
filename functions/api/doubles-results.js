// Resultados de dobles CPZ, independientes de los partidos individuales.
const COOKIE='__Host-leagueos_admin',AGE=8*60*60,te=new TextEncoder();
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const fail=(error,status=400,details)=>respond({ok:false,error,...(details?{details}:{})},status);
async function admin(request,secret){
  if(typeof secret!=='string'||secret.length<12)return false;
  const c=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(v=>v.startsWith(COOKIE+'='));
  if(!c)return false;const p=c.slice(COOKIE.length+1).split('.');
  if(p.length!==4||p[0]!=='1'||!/^[0-9]{13}$/.test(p[1]))return false;
  const expires=Number(p[1]);
  if(expires<Date.now()||expires>Date.now()+AGE*1000)return false;
  try{
    const raw=p[3].replace(/-/g,'+').replace(/_/g,'/');
    const bytes=Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),x=>x.charCodeAt(0));
    const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    return crypto.subtle.verify('HMAC',key,bytes,te.encode(p.slice(0,3).join('.')));
  }catch{return false}
}
function sameOrigin(request){
  if((request.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return false;
  const base=new URL(request.url).origin,origin=request.headers.get('Origin');
  if(origin)return origin===base;
  const site=request.headers.get('Sec-Fetch-Site');
  if(site)return site==='same-origin';
  try{return new URL(request.headers.get('Referer')).origin===base}catch{return false}
}

const GROUP_SIZES={A1:4,A2:4,B1:4,B2:4,B3:4,B4:4,C1:3,C2:3};
function validDate(str){
  if(typeof str!=='string'||!/^\d{4}-\d\d-\d\d$/.test(str))return false;
  const date=new Date(str+'T00:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===str;
}
function parseSets(value){
  if(!Array.isArray(value)||(value.length!==2&&value.length!==3))return null;
  let wins1=0,wins2=0;
  const sets=[];
  for(let i=0;i<value.length;i++){
    if(i===2&&(wins1===2||wins2===2))return null;
    const set=value[i];
    if(!Array.isArray(set)||set.length!==2)return null;
    const a=Number(set[0]),b=Number(set[1]);
    if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||a>99||b>99||Math.max(a,b)<11||Math.abs(a-b)<2)return null;
    sets.push([a,b]);if(a>b)wins1++;else wins2++;
  }
  if(wins1!==2&&wins2!==2)return null;
  return {sets,winner:wins1===2?1:2};
}

async function create(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS cpz_doubles_results (id INTEGER PRIMARY KEY AUTOINCREMENT, group_label TEXT NOT NULL, pair_one INTEGER NOT NULL, pair_two INTEGER NOT NULL, played_at TEXT NOT NULL, round_label TEXT NOT NULL, sets_json TEXT NOT NULL, winner_pair INTEGER NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(group_label,pair_one,pair_two))").run();
}
async function read(db){
 const rows=await db.prepare("SELECT id,group_label AS groupLabel,pair_one AS pair1,pair_two AS pair2,played_at AS date,round_label AS round,sets_json AS setsJson,winner_pair AS winnerPair FROM cpz_doubles_results ORDER BY played_at DESC,id DESC LIMIT 200").all();
 return {ok:true,results:(rows.results||[]).map(x=>({id:x.id,groupLabel:x.groupLabel,pair1:x.pair1,pair2:x.pair2,date:x.date,round:x.round,sets:JSON.parse(x.setsJson),winnerPair:x.winnerPair}))};
}
export async function onRequest({request,env}){
 try{
  if(!env.LEAGUE_DB||!await admin(request,env.ADMIN_PASSWORD))return fail('Solo administración.',401);
  if(!['GET','POST'].includes(request.method))return fail('Método no permitido.',405);
  if(request.method==='POST'&&!sameOrigin(request))return fail('Origen o formato incorrecto.',403);
  await create(env.LEAGUE_DB);
  if(request.method==='GET')return respond(await read(env.LEAGUE_DB));
  const raw=await request.text();if(raw.length>10000)return fail('Solicitud demasiado grande.',413);
  let body;try{body=JSON.parse(raw)}catch{return fail('Datos JSON inválidos.')}
  if(body?.action==='delete'){
   const id=Number(body.id);if(!Number.isSafeInteger(id)||id<1)return fail('Resultado inválido.');
   const result=await env.LEAGUE_DB.prepare('DELETE FROM cpz_doubles_results WHERE id=?').bind(id).run();
   if(!result.meta?.changes)return fail('Resultado inexistente.',404);
   return respond(await read(env.LEAGUE_DB));
  }
  if(body?.action!=='save')return fail('Acción desconocida.');
  const group=String(body.groupLabel||'').toUpperCase(),size=GROUP_SIZES[group];
  const a=Number(body.pair1),b=Number(body.pair2),id=body.id==null?null:Number(body.id);
  if(!size||!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=size||b>=size||a===b)return fail('Selecciona dos parejas diferentes del mismo grupo.');
  if(id!==null&&(!Number.isSafeInteger(id)||id<1))return fail('Resultado inválido.');
  const first=Math.min(a,b),second=Math.max(a,b);
  const date=String(body.date||''),round=String(body.round||'').trim();
  if(!validDate(date)||round.length<1||round.length>60||/[<>\u0000-\u001f]/.test(round))return fail('Fecha o jornada inválida.');
  const parsed=parseSets(body.sets);if(!parsed)return fail('Sets inválidos: dos sets ganados a un mínimo de 11 y diferencia de 2.');
  const winner=parsed.winner===1?a:b;
  const existing=await env.LEAGUE_DB.prepare('SELECT id FROM cpz_doubles_results WHERE group_label=? AND pair_one=? AND pair_two=?').bind(group,first,second).first();
  if(existing?.id&&existing.id!==id)return fail('Este partido ya tiene resultado. Pulsa Editar para corregirlo.',409);
  if(id!==null){
   const previous=await env.LEAGUE_DB.prepare('SELECT id FROM cpz_doubles_results WHERE id=?').bind(id).first();
   if(!previous)return fail('Resultado no encontrado.',404);
   await env.LEAGUE_DB.prepare('UPDATE cpz_doubles_results SET group_label=?,pair_one=?,pair_two=?,played_at=?,round_label=?,sets_json=?,winner_pair=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(group,first,second,date,round,JSON.stringify(a===first?parsed.sets:parsed.sets.map(s=>[s[1],s[0]])),winner,id).run();
  }else{
   await env.LEAGUE_DB.prepare('INSERT INTO cpz_doubles_results(group_label,pair_one,pair_two,played_at,round_label,sets_json,winner_pair) VALUES(?,?,?,?,?,?,?)').bind(group,first,second,date,round,JSON.stringify(a===first?parsed.sets:parsed.sets.map(s=>[s[1],s[0]])),winner).run();
  }
  return respond(await read(env.LEAGUE_DB));
 }catch(error){console.error('Doubles result error',error?.name||'unknown');return fail('No se ha podido guardar el resultado de dobles.',500)}
}
