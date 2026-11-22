// Pruebas aisladas: SQLite en memoria y partidos ficticios exclusivos del test.
// NUNCA conecta con Cloudflare D1 ni publica los tanteos sintéticos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import {onRequest as individualAPI} from '../functions/api/results.js';
import {onRequest as doublesAPI} from '../functions/api/doubles-results.js';
import {NOVEMBER_ROSTER,NOVEMBER_DOUBLES} from '../rosters.js';

globalThis.crypto=webcrypto;
const secret='LOCAL-TEST-ONLY-NEVER-A-REAL-SECRET';
const db=new DatabaseSync(':memory:');
db.exec(`
 CREATE TABLE cpz_player_accounts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_salt TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1
 );
 CREATE TABLE cpz_match_results(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_key TEXT NOT NULL UNIQUE,
  played_at TEXT NOT NULL,
  round_label TEXT NOT NULL,
  group_label TEXT NOT NULL DEFAULT '',
  player_one_id INTEGER NOT NULL,
  player_two_id INTEGER NOT NULL,
  sets_json TEXT NOT NULL,
  winner_id INTEGER NOT NULL,
  source_file TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
 CREATE TABLE cpz_doubles_results(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_label TEXT NOT NULL,
  pair_one INTEGER NOT NULL,
  pair_two INTEGER NOT NULL,
  played_at TEXT NOT NULL,
  round_label TEXT NOT NULL,
  sets_json TEXT NOT NULL,
  winner_pair INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_label,pair_one,pair_two)
 );
`);
for(const name of NOVEMBER_ROSTER.A1) {
 db.prepare('INSERT INTO cpz_player_accounts(player_name,username) VALUES(?,?)')
 .run(name, 'fixture_'+db.prepare('SELECT COUNT(*) AS n FROM cpz_player_accounts').get().n);
}
const beforeRows={
 individual:db.prepare('SELECT count(*) n FROM cpz_match_results').get().n,
 doubles:db.prepare('SELECT count(*) n FROM cpz_doubles_results').get().n
};
const forward=fs.readFileSync('migrations/2026-11-22_soft_delete_audit.sql','utf8');
assert(!/\bDROP\b|\bDELETE\b/gi.test(forward.replace(/^--.*$/gm,'')),'La migración no puede borrar datos');
db.exec(forward);
for(const table of ['cpz_match_results','cpz_doubles_results']) {
 assert(db.prepare('PRAGMA table_info('+table+')').all().some(row=>row.name==='deleted_at'));
}
const wrap={
 prepare(sql){
  const stmt=db.prepare(sql);
  let values=[];
  return {
   bind(...v){values=v;return this},
   async first(){return stmt.get(...values)||null},
   async all(){return {results:stmt.all(...values)}},
   async run(){const changed=stmt.run(...values);return {meta:{changes:changed.changes}}}
  };
 },
 async batch(statements){
  db.exec('BEGIN IMMEDIATE');
  try{
   const answer=[];
   for(const statement of statements) answer.push(await statement.run());
   db.exec('COMMIT');
   return answer;
  }catch(error){db.exec('ROLLBACK');throw error}
 }
};
const expiry=String(Date.now()+2*3600*1000);
const payload='1.'+expiry+'.localtest';
const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const signature=Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))).toString('base64url');
const cookie='__Host-leagueos_admin='+payload+'.'+signature;
const env={LEAGUE_DB:wrap,ADMIN_PASSWORD:secret};
async function request(handler,url,body,asAdmin=true){
 const headers=body?{'Content-Type':'application/json',Origin:'https://example.invalid'}:{};
 if(asAdmin)headers.Cookie=cookie;
 const req=new Request('https://example.invalid'+url,{
  method:body?'POST':'GET',
  headers,
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const res=await handler({request:req,env});
 return {status:res.status,data:await res.json()};
}
function audit(kind,action){
 return db.prepare('SELECT before_json,after_json,result_id FROM cpz_result_audit WHERE competition=? AND action=? ORDER BY id').all(kind,action);
}
function rowCount(table){
 return db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n;
}
const player1=NOVEMBER_ROSTER.A1[0],player2=NOVEMBER_ROSTER.A1[1];
const fixture={action:'manual-save',date:'2026-11-24',round:'Noviembre 2026',groupLabel:'A1',player1Name:player1,player2Name:player2,sets:[[11,5],[11,7]]};

// Ningún jugador no administrador puede escribir o abrir la papelera.
assert.equal((await request(individualAPI,'/api/results', {action:'delete',id:1},false)).status,401);
assert.equal((await request(doublesAPI,'/api/doubles-results',{action:'delete',id:1},false)).status,401);
assert.equal((await request(individualAPI,'/api/results?trash=1',null,false)).status,401);

let created=await request(individualAPI,'/api/results',fixture);
assert.equal(created.status,200,JSON.stringify(created.data));
assert.equal(created.data.results.length,1);
const id=created.data.results[0].id;
assert.equal(rowCount('cpz_match_results'),beforeRows.individual+1);
assert.equal(audit('individual','create').length,1,'Alta debe tener historial');
assert.equal(audit('individual','create')[0].before_json,null);
assert.equal(JSON.parse(audit('individual','create')[0].after_json).id,id);

// Editar genera before / after distintos.
const edited=await request(individualAPI,'/api/results',{...fixture,id,sets:[[11,8],[11,9]]});
assert.equal(edited.status,200,JSON.stringify(edited.data));
assert.equal(audit('individual','edit').length,1);
assert.notEqual(audit('individual','edit')[0].before_json,audit('individual','edit')[0].after_json);

// Borrado reversible: misma fila, ranking sólo usa partidos activos.
const deleted=await request(individualAPI,'/api/results',{action:'delete',id});
assert.equal(deleted.status,200,JSON.stringify(deleted.data));
assert.equal(deleted.data.results.length,0);
assert.equal(rowCount('cpz_match_results'),1,'No eliminar físicamente el resultado');
assert(db.prepare('SELECT deleted_at FROM cpz_match_results WHERE id=?').get(id).deleted_at);
assert.equal(audit('individual','delete').length,1);
assert.notEqual(JSON.parse(audit('individual','delete')[0].after_json).deleted_at,null);
assert.equal((await request(individualAPI,'/api/results?trash=1')).data.results.length,1);
assert.equal((await request(individualAPI,'/api/results',fixture)).status,409,'No recrear cruce borrado');

// Restauración conserva ID y vuelve a las lecturas normales.
const restored=await request(individualAPI,'/api/results',{action:'restore',id});
assert.equal(restored.status,200,JSON.stringify(restored.data));
assert.equal(restored.data.results.length,1);
assert.equal(restored.data.results[0].id,id);
assert.equal(rowCount('cpz_match_results'),1);
assert.equal(db.prepare('SELECT deleted_at FROM cpz_match_results WHERE id=?').get(id).deleted_at,null);
assert.equal(audit('individual','restore').length,1);
assert.equal(JSON.parse(audit('individual','restore')[0].after_json).deleted_at,null);
assert.equal((await request(individualAPI,'/api/results?trash=1')).data.results.length,0);

// Clasificación recalculada por misma lista activa (no alterar datos reales).
const rankingSource=fs.readFileSync('ranking-engine.js','utf8');
const {runInNewContext}=await import('node:vm');
const rankCtx={};runInNewContext(rankingSource,rankCtx);
const rank=rankCtx.CPZRanking.rankCompetition;
const roster=NOVEMBER_ROSTER.A1;
const match=restored.data.results[0];
assert.equal(rank(roster,[]).played,0,'Al borrar no suma un partido');
assert.equal(rank(roster,[{player1:match.player1,player2:match.player2,sets:match.sets}]).played,1,'Al restaurar vuelve a sumar');
assert.equal((await request(individualAPI,'/api/results',{action:'restore',id})).status,404,'No duplicar restauración');

// Importación en lote: cada alta y sobrescritura queda también auditada.
const importedRow={
 date:'2026-11-26',round:'Noviembre 2026',groupLabel:'A1',
 player1:NOVEMBER_ROSTER.A1[2],player2:NOVEMBER_ROSTER.A1[3],sets:[[11,4],[11,7]]
};
const bulk=await request(individualAPI,'/api/results',{
 action:'import',rows:[importedRow],confirm:true,fileName:'local-test.csv',replaceExisting:false
});
assert.equal(bulk.status,200,JSON.stringify(bulk.data));
assert.equal(bulk.data.imported,1);
assert.equal(audit('individual','create').length,2,'Importar debe generar entrada create');
const bulkEdit=await request(individualAPI,'/api/results',{
 action:'import',rows:[{...importedRow,sets:[[11,8],[11,9]]}],
 confirm:true,fileName:'local-test.csv',replaceExisting:true
});
assert.equal(bulkEdit.status,200,JSON.stringify(bulkEdit.data));
assert.equal(audit('individual','edit').length,2,'Sobrescribir por Excel debe generar entrada edit');
assert.notEqual(audit('individual','edit')[1].before_json,audit('individual','edit')[1].after_json);

// Dobles: alta, modificación, borrado y restauración.
const doublesFixture={action:'save',groupLabel:'A1',pair1:0,pair2:1,date:'2026-11-25',round:'Noviembre 2026',sets:[[11,4],[11,6]]};
assert.equal(NOVEMBER_DOUBLES.A1.length>=2,true);
const createdD=await request(doublesAPI,'/api/doubles-results',doublesFixture);
assert.equal(createdD.status,200,JSON.stringify(createdD.data));
assert.equal(createdD.data.results.length,1);
const doubleId=createdD.data.results[0].id;
assert.equal(audit('doubles','create').length,1);
const editD=await request(doublesAPI,'/api/doubles-results',{...doublesFixture,id:doubleId,sets:[[11,7],[11,8]]});
assert.equal(editD.status,200,JSON.stringify(editD.data));
assert.equal(audit('doubles','edit').length,1);
const delD=await request(doublesAPI,'/api/doubles-results',{action:'delete',id:doubleId});
assert.equal(delD.status,200,JSON.stringify(delD.data));
assert.equal(delD.data.results.length,0);
assert.equal(rowCount('cpz_doubles_results'),1);
assert.equal(audit('doubles','delete').length,1);
assert.equal((await request(doublesAPI,'/api/doubles-results',doublesFixture)).status,409);
assert.equal((await request(doublesAPI,'/api/doubles-results?trash=1')).data.results.length,1);
const restoreD=await request(doublesAPI,'/api/doubles-results',{action:'restore',id:doubleId});
assert.equal(restoreD.status,200,JSON.stringify(restoreD.data));
assert.equal(restoreD.data.results[0].id,doubleId);
assert.equal(audit('doubles','restore').length,1);
assert.equal((await request(doublesAPI,'/api/doubles-results?trash=1')).data.results.length,0);

// Deshacer lógico sin DROP ni pérdida de datos.
const rollback=fs.readFileSync('migrations/2026-11-22_soft_delete_audit_rollback.sql','utf8');
assert(!/^\s*(DROP|DELETE)\b/m.test(rollback));
db.exec(rollback);
assert.equal(rowCount('cpz_match_results'),2);
assert.equal(rowCount('cpz_doubles_results'),1);
assert.equal(rowCount('cpz_result_audit'),10,'La marcha atrás no destruye el historial');

// Evitar que se introduzcan operaciones destructivas en el middleware.
const middleware=fs.readFileSync('functions/_middleware.js','utf8');
assert(!middleware.includes('DELETE FROM cpz_match_results'));
assert(!middleware.includes('DELETE FROM cpz_player_accounts'));
console.log('OK: APIs sin acceso de jugador, altas/ediciones/borrados/restauraciones atómicos con historial y ranking recalculado sobre SQLite temporal');
