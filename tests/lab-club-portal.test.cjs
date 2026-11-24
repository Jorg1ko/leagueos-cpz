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
const firstWave=demo.firstWave(scope.CPZ_LAB_DATA.individualGroups);
assert.equal(firstWave.length,7,'Una tarjeta por pista dentro del torneo y pantalla TV');
assert.deepEqual(Array.from(firstWave,m=>m.court),[1,2,3,4,5,6,7],'Pistas 1–7, sin duplicados');
assert(firstWave.every(m=>m.start==='09:00'&&m.end==='09:20'&&m.number===1),'Solo la primera franja horaria');
for(const game of firstWave){
 const group=groups.find(g=>g.court===game.court);
 assert(group,'Cada partido corresponde a un grupo existente');
 const expected=demo.scheduleForGroup(group)[0];
 assert.equal(game.player1,expected.player1,'Los nombres de portada deben coincidir con el calendario');
 assert.equal(game.player2,expected.player2,'Los nombres de portada deben coincidir con el calendario');
 assert.equal(game.groupLabel,group.label,'La pista se corresponde con su grupo');
}

const bracketModel=scope.CPZTournamentBrackets;
const modes=['championship','consolation'];
let bracketTotal=0;
const allPositions=[];
for(const mode of modes){
 const bracket=bracketModel.makeBracket(mode);
 assert.equal(bracket.rounds.length,6,'Seis bloques de eliminación por cuadro');
 assert.equal(bracket.matches.length,25,'25 partidos por cuadro para ranking completo');
 assert.equal(bracket.rounds[0].matches.length,6,'Seis partidos de ronda previa');
 assert(bracket.rounds[0].matches.every(m=>m.pointsTo===11),'Ronda previa a 11');
 assert(bracket.rounds[1].matches.every(m=>m.pointsTo===11),'Cuartos a 11');
 assert(bracket.rounds[2].matches.every(m=>m.pointsTo===15&&m.sets===1),'Semifinales: un set a 15');
 assert.equal(bracket.rounds[3].matches[0].pointsTo,15,'Final a 15');
 assert.equal(bracket.rounds[3].matches[0].sets,1,'Un set en la final');
 assert.equal(bracket.rounds[3].matches[1].pointsTo,null,'Tercer puesto no especificado');
 assert(bracket.rounds[4].matches.every(m=>m.pointsTo===null),'Partidos extra sin puntuación inventada');
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
 assert(matches.every(m=>m.durationMinutes===20&&m.court===group.court&&m.status==='pending'&&m.pointsTo===11),'Pista, puntuación y estado');
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
assert(home.includes('CPZ Open')&&home.includes('CPZ OPEN'),'Nombre oficial del torneo en portada y pantalla TV');
assert(home.includes('class="cpz-open-cover"')&&home.includes('src="./lab-assets/cpz-open-poster.webp"'),'La portada del torneo debe mostrar el cartel CPZ Open');
assert(css.includes('.service-card.tournament-card .service-top')&&css.includes('url("./lab-assets/cpz-open-poster.webp")'),'La portada de la actividad debe usar el mismo cartel');
const posterBytes=fs.readFileSync('lab-assets/cpz-open-poster.webp');
assert(posterBytes.length>15000&&posterBytes.length<200000,'Portada comprimida y con contenido');
assert(posterBytes.subarray(0,4).toString('ascii')==='RIFF'&&posterBytes.subarray(8,12).toString('ascii')==='WEBP','La portada debe ser WebP auténtico');
assert(home.includes('id="traditionalTitle"')&&home.includes('Formato tradicional'),'Formato oficial en el torneo');
assert(home.includes('Individual')&&home.includes('Dobles'),'Dos modalidades oficiales');
for(const text of ['4.5 / 5.0','3.5 / 4.0','Suben a <b>5.0</b>','Bajan a <b>4.5</b>','Suben a <b>4.0</b>','Bajan a <b>3.5</b>','A 11 puntos','Un set a 15'])
 assert(home.includes(text),'Falta regla del cartel: '+text);
assert(home.includes('categoría asignada')&&home.includes('Puntuación por confirmar')===false,'No inventar niveles individuales ni puntuación global');
assert(home.includes('sin separación por modalidades y categorías'),'Las eliminatorias siguen como ensayo');
assert(js.includes('knockout-score-rule'),'Marcador previsto en cada cruce');
assert(js.includes("torneo:'CPZ Open'"),'Ruta del torneo con nombre oficial');
assert(!home.includes('Héroes de Ebro Viejo')&&!js.includes('Héroes de Ebro Viejo'),'No conservar el nombre de trabajo');
const homeEnd=home.indexOf('<section id="areaScreen"');
const tournamentStart=home.indexOf('<div id="tournamentPanel"');
const upcomingStart=home.indexOf('<section class="upcoming-section"');
const groupsStart=home.indexOf('<section class="tournament-groups-section"');
assert(homeEnd>0&&tournamentStart>homeEnd,'Deben mantenerse portada y vista del torneo separadas');
assert(upcomingStart>tournamentStart&&upcomingStart<groupsStart,'Los próximos partidos deben estar DENTRO del torneo, antes de la clasificación');
assert(!home.slice(0,homeEnd).includes('id="upcomingMatches"'),'No debe mostrarse la sección de partidos en la portada');
assert(js.includes('if(!league){renderUpcoming();renderTournamentGroups();'),'Renderizar partidos solo al abrir el torneo');
assert(!/function showHome\(\)\{[\s\S]*?function showArea\(\)/.exec(js)?.[0]?.includes('renderUpcoming()'),'La portada no debe renderizar los próximos partidos');

for(const anchor of ['id="upcomingMatches"','id="openTvBoard"','id="tvBoard"','id="tvMatches"','id="closeTvBoard"'])
 assert(home.includes(anchor),'Debe haber vista de próximos partidos y modo TV: '+anchor);
assert(home.includes('09:00–09:20')&&home.includes('12 de diciembre de 2026')&&home.includes('Horarios de ejemplo'),'La primera franja sigue siendo ejemplo aunque la fecha esté indicada');
assert(js.includes('getFirstWave')&&js.includes('renderUpcoming')&&js.includes('openTvBoard'),'Ambas vistas necesitan los datos de los siete partidos');
assert(js.includes('requestFullscreen')&&js.includes('exitFullscreen')&&js.includes('fullscreenchange'),'Botón pantalla completa y salida sin bloqueo');
assert(js.includes("event.key==='Escape'")&&js.includes('closeTvBoard'),'Escape sale de vista TV');
assert(!/document\.write|window\.open|setInterval|fetch\(|localStorage/i.test(js),'La TV no requiere escrituras, ventanas ni actualizaciones de producción');
assert(css.includes('.tv-board:fullscreen')&&css.includes('.tv-matches'),'Estilo para televisión');
assert(home.includes('12 DIC 2026')&&home.includes('12 de diciembre de 2026'),'La fecha indicada en el cartel es 12 diciembre 2026');
assert(home.includes('Aún no abiertas')&&home.includes('Horarios de ejemplo, aún no definitivos'),'Las inscripciones y horarios siguen pendientes');
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
assert(home.includes('Horarios orientativos desde las 09:00')&&home.includes('Clasificación sin resultados')&&home.includes('Aún no abiertas'),'No presentar el calendario ficticio ni los grupos como resultados o inscripciones oficiales');
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
assert(home.includes('class="league-card-poster"')&&home.includes('src="./lab-assets/liga-cpz-poster.webp"'),'La tarjeta de Liga CPZ debe mostrar su propia portada');
assert(home.includes('class="league-player-poster"')&&home.includes('id="leaguePlayer"'),'Portada visible también al entrar en Liga CPZ');
assert(css.includes('.league-card-poster')&&css.includes('.league-player-intro'),'Diseño responsive para ambas vistas de liga');
assert(css.includes('height:280px;min-height:0;margin:0')&&css.includes('height:235px;border-radius:16px'),'Las tarjetas usan la misma altura de portada que CPZ Open');
assert(css.includes('object-fit:contain;object-position:center'),'El cartel de liga debe verse completo, sin recortes');
assert(css.includes('.service-card.league-card .service-top{')&&css.includes('position:absolute;z-index:1'),'La etiqueta de temporada no debe crear otra fila');
assert(css.includes('.league-player-poster img{display:block;width:100%;height:auto;max-height:none'),'La imagen completa debe respetar su proporción al entrar');

const leaguePoster=fs.readFileSync('lab-assets/liga-cpz-poster.webp');
assert(leaguePoster.length>15000&&leaguePoster.length<250000,'Portada de liga optimizada');
assert(leaguePoster.subarray(0,4).toString('ascii')==='RIFF'&&leaguePoster.subarray(8,12).toString('ascii')==='WEBP','Portada de liga WebP auténtica');

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
console.log('OK: liga conservada, CPZ Open 12 diciembre, inscripciones y horarios de ejemplo, sin Drop-ins ni cambios en producción');
