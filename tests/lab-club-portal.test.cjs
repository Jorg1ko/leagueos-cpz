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
const scope={};scope.globalThis=scope;scope.window=scope;
vm.runInNewContext(dataCode,scope);
vm.runInNewContext(groupCode,scope);
const demo=scope.CPZTournamentDemo;
const groups=demo.makeGroups(scope.CPZ_LAB_DATA.individualGroups);
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
