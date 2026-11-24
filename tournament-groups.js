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
  people:participants.filter((_,index)=>index%7===i)
 }));
 if(groups.some(group=>group.people.length!==4))throw Error('Los grupos no contienen cuatro personas.');
 return groups;
}
root.CPZTournamentDemo={makeGroups,SOURCE_GROUPS,FICTIONAL_NAMES};
})(globalThis);
