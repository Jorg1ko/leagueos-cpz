// Pruebas de reglas de desempate facilitadas por la organización.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('ranking-engine.js','utf8'),context);
const rank=context.CPZRanking.rankCompetition;
const sets=(a,b,c,d)=>[[a,b],[c,d]];
const match=(a,b,s)=>({player1:a,player2:b,sets:s});
{
 const info=rank(['Carlos','Pedro','Luis','Ana'],[
  match('Carlos','Pedro',sets(11,7,11,8)),
  match('Luis','Carlos',sets(11,6,11,9)),
  match('Pedro','Ana',sets(11,9,11,7))
 ]);
 assert(info.rows.findIndex(p=>p.name==='Carlos')<info.rows.findIndex(p=>p.name==='Pedro'),'2 empatados: prevalece enfrentamiento directo');
 assert.equal(info.rows.find(p=>p.name==='Carlos').criterion,'Enfrentamiento directo ganado');
}
{
 const info=rank(['A','B','C'],[
  match('A','B',sets(11,4,11,6)),
  match('B','C',[[11,8],[8,11],[11,9]]),
  match('C','A',[[11,8],[8,11],[11,9]])
 ]);
 assert.deepEqual(Array.from(info.rows,p=>p.name),['A','C','B'],'triple empate: diferencia de sets particular');
 assert.equal(info.warnings.length,0);
 assert.equal(info.complete,true);
}
{
 const info=rank(['A','B','C','D'],[]);
 assert.equal(info.warnings.length,1,'cuádruple empate sin norma específica se avisa');
 assert(info.rows.every(p=>p.unresolved),'ningún puesto debe declararse resuelto');
 assert.equal(info.complete,false);
}
{
 const info=rank(['A','B','C'],[match('A','C',sets(11,2,11,2)),match('B','C',sets(11,9,11,8))]);
 assert(info.warnings.some(w=>w.includes('enfrentamiento directo')),'directo pendiente se señaliza');
 assert.equal(info.complete,false);
}
console.log('Ranking CPZ: desempate de 2, miniclasificación de 3, 4 sin regla y partidos pendientes: OK');
