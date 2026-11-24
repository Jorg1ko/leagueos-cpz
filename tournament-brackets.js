/* Cuadros de eliminatorias del laboratorio. No se registran participantes ni resultados. */
(function(root){
'use strict';
const MODE=Object.freeze({
 championship:{name:'Cuadro principal',description:'1.º y 2.º de cada grupo',offset:0},
 consolation:{name:'Cuadro de consolación',description:'3.º y 4.º de cada grupo',offset:14}
});
const placementPairs=[[1,2],[3,4],[5,6],[7,8],[9,10],[11,12],[13,14]];
function makeBracket(mode){
 const meta=MODE[mode];
 if(!meta)throw Error('Cuadro desconocido');
 const place=n=>n+meta.offset;
 const match=(id,a,b,ranks)=>({
  id,slot1:a,slot2:b,
  ...(ranks?{winnerPosition:place(ranks[0]),loserPosition:place(ranks[1])}:{})
 });
 const rounds=[
  {id:'prelim',title:'Ronda previa',description:'12 participantes · 6 cruces · 2 pases directos a cuartos por mejor diferencia de puntos',matches:[
   match('P1','Serie 8','Serie 9'),
   match('P2','Serie 4','Serie 13'),
   match('P3','Serie 5','Serie 12'),
   match('P4','Serie 7','Serie 10'),
   match('P5','Serie 3','Serie 14'),
   match('P6','Serie 6','Serie 11')
  ]},
  {id:'quarter',title:'Cuartos de final',description:'8 participantes · los dos mejores por diferencia de puntos ya están clasificados',matches:[
   match('C1','Serie 1 · pase directo','Ganador P1'),
   match('C2','Ganador P2','Ganador P3'),
   match('C3','Serie 2 · pase directo','Ganador P4'),
   match('C4','Ganador P5','Ganador P6')
  ]},
  {id:'semi',title:'Semifinales',description:'Los cuatro vencedores de cuartos',matches:[
   match('S1','Ganador C1','Ganador C2'),
   match('S2','Ganador C3','Ganador C4')
  ]},
  {id:'medals',title:'Final y tercer puesto',description:'Definen las cuatro primeras posiciones de este cuadro',matches:[
   match('F1','Ganador S1','Ganador S2',[1,2]),
   match('F3','Perdedor S1','Perdedor S2',[3,4])
  ]},
  {id:'middle',title:'Puestos '+place(5)+' al '+place(8),description:'Los perdedores de cuartos siguen jugando para ordenar las posiciones',matches:[
   match('M1','Perdedor C1','Perdedor C2'),
   match('M2','Perdedor C3','Perdedor C4'),
   match('F5','Ganador M1','Ganador M2',[5,6]),
   match('F7','Perdedor M1','Perdedor M2',[7,8])
  ]},
  {id:'lower',title:'Puestos '+place(9)+' al '+place(14),description:'Los seis eliminados en la previa disputan sus posiciones. Los dos con mejor diferencia de puntos pasan directamente a esta semifinal.',matches:[
   match('R1','Eliminado de previa · serie 3','Eliminado de previa · serie 6'),
   match('R2','Eliminado de previa · serie 4','Eliminado de previa · serie 5'),
   match('R3','Eliminado de previa · serie 1 (pase)','Ganador R1'),
   match('R4','Eliminado de previa · serie 2 (pase)','Ganador R2'),
   match('F9','Ganador R3','Ganador R4',[9,10]),
   match('F11','Perdedor R3','Perdedor R4',[11,12]),
   match('F13','Perdedor R1','Perdedor R2',[13,14])
  ]}
 ];
 const matches=rounds.flatMap(r=>r.matches);
 const resultPositions=matches.filter(m=>'winnerPosition' in m).flatMap(m=>[m.winnerPosition,m.loserPosition]);
 if(matches.length!==25||new Set(resultPositions).size!==14||resultPositions.length!==14){
  throw Error('El cuadro no asigna 14 posiciones distintas');
 }
 return {mode,name:meta.name,description:meta.description,offset:meta.offset,rounds,matches,
         positions:Array.from({length:14},(_,i)=>place(i+1))};
}
function compareScore(a,b){
 return b.pointDifference-a.pointDifference ||
        b.setDifference-a.setDifference ||
        b.wins-a.wins;
}
// Selección solo cuando haya resultados finales de grupos: nunca asignar pases a ciegas.
function selectDirectPasses(entries,count=2){
 if(!Array.isArray(entries)||![6,14].includes(entries.length)||count!==2)throw Error('Se necesitan 6 o 14 candidatos y dos pases');
 const ids=new Set();
 for(const e of entries){
  if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id))throw Error('Candidatos sin identificador único');
  ids.add(e.id);
  if(!['pointDifference','setDifference','wins'].every(k=>Number.isFinite(e[k])))throw Error('Faltan estadísticas de clasificación');
 }
 const sorted=[...entries].sort(compareScore);
 if(compareScore(sorted[count-1],sorted[count])===0){
  return {ready:false,reason:'Empate en el corte de pases directos: decidir criterio de desempate sin sorteo automático',passes:[],remaining:[]};
 }
 return {ready:true,passes:sorted.slice(0,count),remaining:sorted.slice(count)};
}
root.CPZTournamentBrackets={makeBracket,selectDirectPasses,placementPairs};
})(globalThis);
