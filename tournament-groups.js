/* Torneo CPZ · distribución de demostración, sin inscripciones reales. */
(function(root){
'use strict';
const SOURCE_GROUPS=Object.freeze(['A1','A2','A3','A4','A5']);
const GROUP_LABELS=Object.freeze(['A','B','C','D','E','F','G']);
// Personajes inventados solo para rellenar la maqueta; nunca en la liga oficial.
const FICTIONAL_NAMES=Object.freeze([
 'Paco el del Sobaco',
 'Tino el Cochino',
 'Pepe el del Culete',
 'Tito el del Pedito',
 'Rafa el del Culo de Jirafa',
 'Lolo el del Moco Solo',
 'Nacho el del Pedo Macho',
 'Manolo el Cagabolos'
]);
function makeGroups(individualGroups){
 if(!individualGroups||typeof individualGroups!=='object')throw Error('La plantilla de la liga no está disponible.');
 const reference=SOURCE_GROUPS.flatMap(key=>{
  const names=individualGroups[key];
  if(!Array.isArray(names)||names.length!==4||names.some(n=>typeof n!=='string'||!n.trim()))throw Error('La plantilla del grupo A no está completa.');
  return names;
 });
 if(reference.length!==20||new Set(reference).size!==20)throw Error('Los nombres de referencia no son únicos.');
 const participants=[
  ...reference.map(name=>({name,kind:'reference'})),
  ...FICTIONAL_NAMES.map(name=>({name,kind:'fictional'}))
 ];
 if(new Set(participants.map(p=>p.name)).size!==28)throw Error('Los nombres del torneo no son únicos.');
 const groups=GROUP_LABELS.map((label,i)=>({
  label,
  court:i+1,
  people:participants.filter((_,index)=>index%7===i)
 }));
 if(groups.some(group=>group.people.length!==4))throw Error('Los grupos no contienen cuatro personas.');
 return groups;
}

const PAIRS=[[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]];
function clock(minutes){return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')}
function scheduleForGroup(group){
 if(!group||!Number.isInteger(group.court)||group.court<1||group.court>7||!Array.isArray(group.people)||group.people.length!==4)throw Error('Grupo no válido');
 const names=group.people.map(p=>p.name);
 if(names.some(n=>typeof n!=='string'||!n.trim())||new Set(names).size!==4)throw Error('Plantilla incorrecta');
 return PAIRS.map(([a,b],i)=>({
  number:i+1,player1:names[a],player2:names[b],court:group.court,
  start:clock(9*60+i*20),end:clock(9*60+(i+1)*20),
  durationMinutes:20,status:'pending'
 }));
}
function firstWave(individualGroups){
 return makeGroups(individualGroups).map(group=>{
  const game=scheduleForGroup(group)[0];
  if(!game||game.start!=='09:00'||game.end!=='09:20')throw Error('La primera franja no coincide con el calendario.');
  return {...game,groupLabel:group.label};
 });
}
root.CPZTournamentDemo={makeGroups,scheduleForGroup,firstWave,SOURCE_GROUPS,FICTIONAL_NAMES};
})(globalThis);
