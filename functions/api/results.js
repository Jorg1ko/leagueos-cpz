// Importación controlada de resultados del ranking CPZ 2026/27.
// Únicamente admin; Excel se analiza localmente, el servidor valida y guarda filas en D1.
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
async function create(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_match_results (id INTEGER PRIMARY KEY AUTOINCREMENT, match_key TEXT NOT NULL UNIQUE, played_at TEXT NOT NULL, round_label TEXT NOT NULL, group_label TEXT NOT NULL DEFAULT '', player_one_id INTEGER NOT NULL, player_two_id INTEGER NOT NULL, sets_json TEXT NOT NULL, winner_id INTEGER NOT NULL, source_file TEXT NOT NULL DEFAULT '', imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
const normal=name=>typeof name==='string'?name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim().replace(/\s+/g,' '):'';
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
async function read(db){
  const rows=await db.prepare("SELECT r.id,r.played_at AS date,r.round_label AS round,r.group_label AS groupLabel,a.player_name AS player1,b.player_name AS player2,r.sets_json AS setsJson,r.winner_id AS winnerId,r.player_one_id AS player1Id,r.player_two_id AS player2Id,r.source_file AS sourceFile,r.imported_at AS importedAt FROM cpz_match_results r LEFT JOIN cpz_player_accounts a ON a.id=r.player_one_id LEFT JOIN cpz_player_accounts b ON b.id=r.player_two_id ORDER BY r.played_at DESC,r.id DESC LIMIT 2500").all();
  return {ok:true,results:(rows.results||[]).map(x=>({id:x.id,date:x.date,round:x.round,groupLabel:x.groupLabel,player1:x.player1||'Jugador eliminado',player2:x.player2||'Jugador eliminado',sets:JSON.parse(x.setsJson),winner:x.winnerId===x.player1Id?(x.player1||'Jugador eliminado'):(x.player2||'Jugador eliminado'),sourceFile:x.sourceFile,importedAt:x.importedAt})),total:rows.results?.length||0};
}
export async function onRequest({request,env}){
  try{
    if(!env.LEAGUE_DB||!await admin(request,env.ADMIN_PASSWORD))return fail('Acceso exclusivo del administrador.',401);
    if(!['GET','POST'].includes(request.method))return fail('Método no permitido.',405);
    if(request.method==='POST'&&!sameOrigin(request))return fail('Origen o formato incorrecto.',403);
    await create(env.LEAGUE_DB);
    if(request.method==='GET')return respond(await read(env.LEAGUE_DB));
    const raw=await request.text();
    if(raw.length>130000)return fail('Importación demasiado grande (máximo 200 partidos).',413);
    const body=JSON.parse(raw);
    if(body?.action==='delete'){
      const id=Number(body.id);
      if(!Number.isSafeInteger(id)||id<=0)return fail('ID inválido.');
      await env.LEAGUE_DB.prepare('DELETE FROM cpz_match_results WHERE id=?').bind(id).run();
      return respond(await read(env.LEAGUE_DB));
    }
    if(body?.action!=='import'||!Array.isArray(body.rows)||body.rows.length<1||body.rows.length>200||body.confirm!==true)
      return fail('Primero revisa y confirma un archivo de 1 a 200 resultados.');
    const all=await env.LEAGUE_DB.prepare('SELECT id,player_name FROM cpz_player_accounts WHERE enabled=1').all();
    const members=new Map((all.results||[]).map(p=>[normal(p.player_name),p]));
    if(!members.size)return fail('Crea primero las cuentas de jugadores antes de importar resultados.');
    const items=[],issues=[],keys=new Set();
    for(let i=0;i<body.rows.length;i++){
      const row=body.rows[i];if(!row||typeof row!=='object'){issues.push('Fila '+(i+2)+': formato inválido');continue}
      const first=members.get(normal(row.player1)),second=members.get(normal(row.player2));
      const date=typeof row.date==='string'?row.date.trim():'';
      const round=typeof row.round==='string'?row.round.trim():'';
      const group=typeof row.groupLabel==='string'?row.groupLabel.trim():'';
      const sets=parseSets(row.sets);
      if(!first||!second){issues.push('Fila '+(i+2)+': uno o ambos jugadores no tienen una cuenta activa');continue}
      if(first.id===second.id){issues.push('Fila '+(i+2)+': los jugadores deben ser distintos');continue}
      if(!validDate(date)||!round||round.length>60||group.length>40||/[<>\u0000-\u001f]/.test(round+group)){issues.push('Fila '+(i+2)+': fecha, jornada o grupo inválido');continue}
      if(!sets){issues.push('Fila '+(i+2)+': sets inválidos; se exige ganar 2 sets a 11 con diferencia de 2');continue}
      const ids=[first.id,second.id].sort((a,b)=>a-b);
      const key=date+'|'+normal(round)+'|'+ids[0]+'-'+ids[1];
      if(keys.has(key)){issues.push('Fila '+(i+2)+': partido repetido dentro del archivo');continue}
      keys.add(key);
      items.push({key,date,round,group,id1:first.id,id2:second.id,sets:sets.sets,winner:sets.winner===1?first.id:second.id});
    }
    if(issues.length)return fail('Hay errores en el archivo. No se ha guardado ningún partido.',422,issues.slice(0,35));
    if(body.replaceExisting!==true){
      for(const item of items){
        const existing=await env.LEAGUE_DB.prepare('SELECT id FROM cpz_match_results WHERE match_key=?').bind(item.key).first();
        if(existing)return fail('Hay partidos que ya existen. Activa «Actualizar partidos existentes» solo si quieres sobrescribirlos.',409);
      }
    }
    const file=typeof body.fileName==='string'?body.fileName.slice(0,120):'';
    const stmts=items.map(x=>env.LEAGUE_DB.prepare(
      body.replaceExisting===true
        ?"INSERT INTO cpz_match_results (match_key,played_at,round_label,group_label,player_one_id,player_two_id,sets_json,winner_id,source_file) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(match_key) DO UPDATE SET played_at=excluded.played_at,round_label=excluded.round_label,group_label=excluded.group_label,player_one_id=excluded.player_one_id,player_two_id=excluded.player_two_id,sets_json=excluded.sets_json,winner_id=excluded.winner_id,source_file=excluded.source_file,imported_at=CURRENT_TIMESTAMP"
        :"INSERT INTO cpz_match_results (match_key,played_at,round_label,group_label,player_one_id,player_two_id,sets_json,winner_id,source_file) VALUES(?,?,?,?,?,?,?,?,?)"
    ).bind(x.key,x.date,x.round,x.group,x.id1,x.id2,JSON.stringify(x.sets),x.winner,file));
    // D1 batch es transaccional: ningún resultado se guarda si alguna fila falla.
    await env.LEAGUE_DB.batch(stmts);
    const data=await read(env.LEAGUE_DB);
    return respond({...data,imported:items.length});
  }catch(error){
    console.error('CPZ result import',error?.name||'error');
    return fail('No se pudo importar el archivo. Comprueba que no hay duplicados o datos inválidos.',500);
  }
}
