'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const home=fs.readFileSync('club-portal.html','utf8');
const league=fs.readFileSync('player.html','utf8');
const js=fs.readFileSync('club-portal.js','utf8');
const css=fs.readFileSync('club-portal.css','utf8');
const workflow=fs.readFileSync('.github/workflows/laboratorio-movil.yml','utf8');
const dataCode=fs.readFileSync('lab-data.js','utf8');
const groupCode=fs.readFileSync('tournament-groups.js','utf8');
const bracketCode=fs.readFileSync('tournament-brackets.js','utf8');
const scope={};scope.globalThis=scope;scope.window=scope;
vm.runInNewContext(dataCode,scope);
vm.runInNewContext(groupCode,scope);
vm.runInNewContext(bracketCode,scope);
const demo=scope.CPZTournamentDemo;
const groups=demo.makeGroups(scope.CPZ_LAB_DATA.individualGroups);
const bracketModel=scope.CPZTournamentBrackets;
const modes=['championship','consolation'];
let bracketTotal=0;
const allPositions=[];
for(const mode of modes){
 const bracket=bracketModel.makeBracket(mode);
 assert.equal(bracket.rounds.length,6,'Seis bloques de eliminación por cuadro');
 assert.equal(bracket.matches.length,25,'25 partidos por cuadro para ranking completo');
 assert.equal(bracket.rounds[0].matches.length,6,'Seis partidos de ronda previa');
 assert.equal(bracket.rounds[1].matches.length,4,'Cuatro cuartos');
 assert.equal(bracket.rounds[2].matches.length,2,'Dos semifinales');
 assert.equal(bracket.rounds[3].matches.length,2,'Final y tercer puesto');
 assert.equal(bracket.rounds[4].matches.length,4,'Puestos quinto a octavo');
 assert.equal(bracket.rounds[5].matches.length,7,'Puestos noveno a catorce');
 assert.equal(bracket.matches.filter(m=>m.slot1.includes('pase directo')||m.slot1.includes('(pase)')).length,4,'Pases directos en ambas ramas de clasificación');
 assert.equal(bracket.matches.filter(m=>'winnerPosition' in m).length,7,'Siete partidos definen catorce posiciones');
 assert(bracket.matches.every(m=>!('player1' in m)&&!('player2' in m)&&!('winner' in m)), 'El cuadro no revela nombres ni inventa ganadores');
 assert(bracket.rounds[1].matches[0].slot1.includes('Serie 1'),'Mejor diferencia de puntos pasa a cuartos');
 bracketTotal+=bracket.matches.length;
 allPositions.push(...Array.from(bracket.positions));
}
assert.equal(bracketTotal,50,'Dos cuadros suman 50 partidos');
assert.deepEqual(allPositions,Array.from({length:28},(_,i)=>i+1),'Puestos 1.º a 28.º exactamente una vez');
const candidates=Array.from({length:14},(_,i)=>({id:'T'+i,pointDifference:14-i,setDifference:5,wins:2}));
const seeded=bracketModel.selectDirectPasses(candidates);
assert.equal(seeded.ready,true);
assert.deepEqual(Array.from(seeded.passes,e=>e.id),['T0','T1'],'Pases directos por diferencia de puntos');
const tied=candidates.map(e=>({...e}));
tied[2].pointDifference=tied[1].pointDifference;tied[2].setDifference=tied[1].setDifference;tied[2].wins=tied[1].wins;
assert.equal(bracketModel.selectDirectPasses(tied).ready,false,'Un empate exacto no debe sortearse automáticamente');
assert.throws(()=>bracketModel.selectDirectPasses(candidates.slice(0,4)),/6 o 14/,'Número incorrecto de participantes');
assert.equal(groups.length,7,'Deben existir 7 grupos');
assert.deepEqual(Array.from(groups,g=>g.court),[1,2,3,4,5,6,7],'Pistas 1–7');
let totalMatches=0;
for(const group of groups){
 const matches=demo.scheduleForGroup(group);totalMatches+=matches.length;
 assert.equal(matches.length,6,'6 partidos por grupo');
 assert.deepEqual(Array.from(matches,m=>m.start),['09:00','09:20','09:40','10:00','10:20','10:40'],'Turnos 20min desde 9');
 assert.deepEqual(Array.from(matches,m=>m.end),['09:20','09:40','10:00','10:20','10:40','11:00'],'Terminan a las 11');
 assert(matches.every(m=>m.durationMinutes===20&&m.court===group.court&&m.status==='pending'),'Pista y estado');
 assert(matches.every(m=>!m.sets&&!m.score&&!m.winner),'No inventar resultados');
 const ids=matches.map(m=>[m.player1,m.player2].sort().join('|'));
 assert.equal(new Set(ids).size,6,'Sin cruces repetidos');
 assert(group.people.every(p=>matches.filter(m=>m.player1===p.name||m.player2===p.name).length===3),'Todos juegan 3');
}
assert.equal(totalMatches,42,'42 partidos en 7 pistas');
assert.deepEqual(Array.from(groups,g=>g.label),['A','B','C','D','E','F','G'],'Grupos A-G');
assert(groups.every(g=>g.people.length===4),'4 participantes por grupo');
const people=Array.from(groups,g=>g.people).flat();
assert.equal(people.length,28,'Deben ser 28 participantes');
assert.equal(new Set(people.map(p=>p.name)).size,28,'No puede haber nombres duplicados');
assert.equal(people.filter(p=>p.kind==='reference').length,20,'20 referencias de la liga A');
assert.equal(people.filter(p=>p.kind==='fictional').length,8,'8 nombres inventados');
const references=['A1','A2','A3','A4','A5'].flatMap(k=>scope.CPZ_LAB_DATA.individualGroups[k]);
assert.deepEqual(Array.from(people.filter(p=>p.kind==='reference'),p=>p.name).sort(),references.slice().sort(),
 'Deben usar exclusivamente los nombres reales de A1-A5 como referencia');
assert(people.some(p=>p.kind==='fictional'&&p.name.includes('Sobaco')),'Faltan nombres humorísticos');
assert.throws(()=>demo.makeGroups({}),/plantilla/i,'No fabricar listas si faltan datos originales');
assert(workflow.includes('cp tournament-groups.js lab-static/dist/tournament-groups.js'),'El modelo debe desplegarse');


for(const tag of ['id="homeScreen"','id="areaScreen"','data-go="liga"','data-go="torneo"','id="leaguePlayer"','id="tournamentPanel"']){
 assert(home.includes(tag),'Falta función de club: '+tag);
}
assert(home.includes('Torneo de Héroes de Ebro Viejo'),'Nombre provisional del torneo');
assert(home.includes('Diciembre 2026')&&home.includes('Diciembre de 2026'),'El torneo está previsto para diciembre de 2026');
assert(home.includes('Aún no abiertas')&&home.includes('Día y horario por confirmar'),'No deben anunciarse fechas ni inscripciones inventadas');
assert(home.includes('7 grupos de 4')&&home.includes('id="tournamentGroups"'),'7 grupos de 4');
assert(home.includes('id="tournamentGroupSelect"')&&home.includes('<select'),'Selector desplegable');
assert(home.includes('09:00–11:00')&&home.includes('20 min'),'Horario ejemplo');
assert(home.includes('./ranking-engine.js')&&js.includes('rankCompetition(chosen.people.map(p=>p.name),[])'),'Usa motor de liga sin resultados');
assert(home.includes('id="tournamentBracket"')&&home.includes('id="tournamentPlacementList"'),'Cuadro de eliminatorias y clasificación general');
assert(home.includes('id="knockoutChampionship"')&&home.includes('id="knockoutConsolation"'),'Dos cuadros separados');
assert(home.includes('tournament-brackets.js')&&workflow.includes('cp tournament-brackets.js lab-static/dist/tournament-brackets.js'),'Modelo de eliminatorias publicado');
assert(js.includes("renderTournamentBracket()")&&js.includes("renderTournamentPlacements()"),'Las eliminatorias y posiciones se renderizan');
assert(js.includes('statsDetails')&&js.includes('renderRanking')&&js.includes('renderFixtures'),'Ranking y partidos');
assert(js.includes("tournamentGroupSelect').addEventListener('change'"),'Interacción del desplegable');
assert(home.includes('Horarios orientativos desde las 09:00')&&home.includes('Clasificación sin resultados.')&&home.includes('Aún no abiertas'),'No presentar el calendario ficticio ni los grupos como resultados o inscripciones oficiales');
assert(!/LABORATORIO|Prototipo de prueba|SIMULACIÓN DE GRUPOS|Personaje ficticio|Referencia de liga A|<span class="demo-suffix">/.test(home),'La interfaz pública no debe mostrar controles ni explicaciones internas');
assert(!/tournament-person-kind|Referencia liga|Inventado/.test(js),'Los listados públicos solo deben mostrar nombres');
assert(home.includes('./lab-data.js')&&home.includes('./tournament-groups.js'),'Debe reutilizar los nombres de la liga');
assert(!/drop.?in|dropPlayer|dropAdmin|signupForm|sessionForm|homeTuesdayDate|homeThursdayDate|data-go="martes"|data-go="jueves"/i.test(home),'Los Drop-ins ya no deben figurar en la vista');
assert(!/drop.?in|localStorage|signupForm|sessionForm|fetch\(|XMLHttpRequest|\/api\//i.test(js),'El portal es solo informativo, sin altas ni acceso a API');
assert(!js.includes('innerHTML'),'Evitar inserción de HTML dinámico');
assert(!/<form\b/i.test(home),'No se recogerán inscripciones ni datos de visitantes');
assert(!home.includes('club-portal-model.js')&&!workflow.includes('club-portal-model.js'),'Modelo antiguo no desplegado');
assert(home.includes('href="./liga.html"'),'La liga sigue accesible');
assert(league.includes('href="./" aria-label="Volver al inicio'),'La liga debe enlazar al portal');
assert(!home.includes('id="leagueAdmin"')&&!home.includes('id="roleSwitch"'),'No debe mostrarse administración de prueba');
assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'Portada con dos actividades');
assert(css.includes('.service-card.tournament-card .service-top'),'Tarjeta del torneo con imagen');
assert(css.includes('@media(max-width:700px)'),'Diseño adaptado a móvil');
assert(css.includes('prefers-color-scheme:dark'),'Debe conservar el modo oscuro');
assert(home.includes('./lab-assets/escudo-cpz.webp'),'Escudo local');
const photoNames=['pistas-cpz.jpg','partidos-cpz.jpg','alquiler-cpz.jpg','escudo-cpz.webp'];
for(const filename of photoNames){
 assert(fs.existsSync('lab-assets/'+filename),'Imagen no encontrada: '+filename);
 const blob=fs.readFileSync('lab-assets/'+filename);
 assert(blob.length>2000,'Imagen vacía: '+filename);
 if(filename.endsWith('.jpg'))assert(css.includes('./lab-assets/'+filename),'Imagen no utilizada en CSS: '+filename);
}
assert(!css.includes('clubpickleballzaragoza.com/wp-content/uploads/'),'Fotos externas no permitidas');
new vm.Script(js);
console.log('OK: liga conservada, torneo provisional diciembre, sin Drop-ins ni formularios, móvil y modo oscuro');
