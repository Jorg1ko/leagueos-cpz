'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const sandbox={};
vm.runInNewContext(fs.readFileSync('lab-features.js','utf8'),sandbox);
const {pendingMatches,searchParticipants,validSets}=sandbox.CPZLabFeatures;
const roster=['Ana','Bea','Carlos','Diego'];
const played=[
 {player1:'Ana',player2:'Bea',sets:[[11,8],[11,6]]},
 {player1:' Carlos ',player2:'Ana',sets:[[11,9],[8,11],[11,6]]},
 {player1:'Ana',player2:'Bea',sets:[[11,8],[11,6]]} // duplicate should not count twice
];
const pending=pendingMatches(roster,played);
assert.equal(pending.played,2);
assert.equal(pending.expected,6);
assert.equal(pending.pending.length,4);
assert.equal(pending.pending.some(p=>p.player1==='Ana'&&p.player2==='Diego'),true);
assert.equal(pending.pending.some(p=>p.player1==='Ana'&&p.player2==='Bea'),false);
assert.equal(pendingMatches(['A','B','C'],[]).pending.length,3);
assert.equal(pendingMatches(['A','B','C'],[{player1:'A',player2:'B',sets:[[11,3],[9,11]]}]).played,0,'Incomplete scores cannot hide pending fixture');
assert.equal(pendingMatches(['A','B','C'],[{player1:'A',player2:'B',sets:[[11,3],[11,9]]}]).played,1);
assert.equal(validSets([[11,8],[11,6]]),true);
assert.equal(validSets([[11,8],[9,11],[11,6]]),true);
assert.equal(validSets([[11,8],[9,11]]),false);

const data={
 individualGroups:{A1:['Álvaro Gómez','Ana','María'],B1:['Carlos','Bea']},
 doublesGroups:{A1:[['Ana','Jorge'],['Álvaro Gómez','Luis']],B1:[['Bea','Marta']]}
};
assert.equal(searchParticipants(data,'alvaro').length,2,'Search ignores accents in singles and doubles');
assert.equal(searchParticipants(data,'jorge').length,1,'Find a doubles player by either member of pair');
assert.equal(searchParticipants(data,'jorge')[0].name,'Ana / Jorge');
assert.equal(searchParticipants(data,'mArIa')[0].group,'A1');
assert.equal(searchParticipants(data,'a').length,0,'Avoid noisy one-character search');
assert.equal(searchParticipants(data,'inexistente').length,0);

const html=fs.readFileSync('player.html','utf8');
for(const value of ['mobile-standings','standing-row-main','standing-meta','renderPending(root,type,group,people)','match-score-summary','match-set-lines',"'Sets '+pair1+'–'+pair2"])
 assert(html.includes(value), 'Missing UI: '+value);
for(const value of ['id="playerSearch"','data-page="results"','id="resultsPanel"','Ver estadísticas completas','mobile-expanded','renderAll()','function renderPlayerSearch()'])
 assert(!html.includes(value), 'Obsolete or expandable UI found: '+value);
assert(html.includes("stat('Sets',p.sf+'–'+p.sc"),'Sets must always be visible');
assert(html.includes("stat('Puntos',p.pf+'–'+p.pc"),'Points must always be visible');
assert(html.includes("stat('PTS',p.pts)"),'Ranking informational points must remain visible');
assert(!html.includes('https://wa.me/'),'WhatsApp sharing is not wanted');
assert(!html.includes('cpz-podium'),'Podium is not wanted');
console.log('OK: pendientes, clasificación compacta siempre visible, resultados integrados, sin búsqueda ni podio');
