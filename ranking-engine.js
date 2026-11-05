// Ranking CPZ 2026/27: reglas facilitadas por la organización.
// Esta función no convierte posiciones provisionales en definitivas.
(function(root){
'use strict';
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
function rankCompetition(names,matches){
 const rows=names.map((name,order)=>({name,order,pj:0,pg:0,pp:0,sf:0,sc:0,pf:0,pc:0,pts:0,criterion:'',unresolved:false}));
 const by=new Map(rows.map(p=>[norm(p.name),p]));
 const valid=[];
 for(const m of matches||[]){
  const a=by.get(norm(m.player1)),b=by.get(norm(m.player2));if(!a||!b||a===b)continue;
  const sets=m.sets;if(!Array.isArray(sets)||(sets.length!==2&&sets.length!==3))continue;
  let sa=0,sb=0,pa=0,pb=0,ok=true;
  for(const set of sets){if(!Array.isArray(set)||set.length!==2||!set.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=99)||set[0]===set[1]){ok=false;break}
    if(set[0]>set[1])sa++;else sb++;pa+=set[0];pb+=set[1]}
  if(!ok||Math.max(sa,sb)!==2||sa===sb)continue;
  a.pj++;b.pj++;a.sf+=sa;a.sc+=sb;b.sf+=sb;b.sc+=sa;a.pf+=pa;a.pc+=pb;b.pf+=pb;b.pc+=pa;
  const winner=sa>sb?a:b;winner.pg++;(winner===a?b:a).pp++;
  valid.push({a,b,sa,sb,pa,pb,winner});
 }
 rows.forEach(p=>{p.pts=p.pg*3;p.criterion=p.pj?'Victorias':'Posición inicial; sin resultados'});
 const groups=new Map();
 for(const p of rows){const arr=groups.get(p.pg)||[];arr.push(p);groups.set(p.pg,arr)}
 const ordered=[],warnings=[];
 for(const wins of [...groups.keys()].sort((a,b)=>b-a)){
  const tied=groups.get(wins);
  if(tied.length===1){ordered.push(...tied);continue}
  if(tied.length===2){
   const [a,b]=tied,duels=valid.filter(g=>(g.a===a&&g.b===b)||(g.a===b&&g.b===a));
   if(duels.length===1){
    const winner=duels[0].winner,loser=winner===a?b:a;
    winner.criterion='Enfrentamiento directo ganado';loser.criterion='Enfrentamiento directo perdido';
    ordered.push(winner,loser);continue;
   }
   const criteria=[['Diferencia de sets',p=>p.sf-p.sc],['Diferencia de puntos',p=>p.pf-p.pc],['Puntos a favor',p=>p.pf]];
   const compared=[...tied].sort((x,y)=>{
    for(const [,fn] of criteria){const diff=fn(y)-fn(x);if(diff)return diff}return x.order-y.order;
   });
   compared.forEach(p=>{p.unresolved=true;p.criterion=duels.length?'Enfrentamiento directo ambiguo; revisión pendiente':'Enfrentamiento directo pendiente; orden provisional'});
   warnings.push('Empate a '+wins+' victorias: enfrentamiento directo no resuelto');
   ordered.push(...compared);continue;
  }
  if(tied.length===3){
   const mini=new Map(tied.map(p=>[p,{sf:0,sc:0,pf:0,pc:0}]));
   const games=valid.filter(g=>mini.has(g.a)&&mini.has(g.b));
   for(const g of games){const a=mini.get(g.a),b=mini.get(g.b);a.sf+=g.sa;a.sc+=g.sb;a.pf+=g.pa;a.pc+=g.pb;b.sf+=g.sb;b.sc+=g.sa;b.pf+=g.pb;b.pc+=g.pa}
   const metrics=[['Diferencia de sets en triple empate',p=>mini.get(p).sf-mini.get(p).sc],['Diferencia de puntos en triple empate',p=>mini.get(p).pf-mini.get(p).pc],['Puntos a favor en triple empate',p=>mini.get(p).pf]];
   const compared=[...tied].sort((a,b)=>{for(const [,value] of metrics){const diff=value(b)-value(a);if(diff)return diff}return a.order-b.order});
   const completed=games.length===3&&new Set(games.map(g=>[g.a.order,g.b.order].sort((a,b)=>a-b).join('|'))).size===3;
   compared.forEach((p,i)=>{const next=compared[i+1],prev=compared[i-1];
    let criterion='Miniclasificación entre 3';
    for(const [label,value] of metrics){if((next&&value(p)!==value(next))||(prev&&value(p)!==value(prev))){criterion=label;break}}
    const stillEqual=compared.some(q=>q!==p&&metrics.every(([,value])=>value(p)===value(q)));
    p.unresolved=!completed||stillEqual;
    p.criterion=stillEqual?'Triple empate sin resolver':criterion+(completed?'':' (provisional: faltan enfrentamientos)');
   });
   if(!completed||compared.some(p=>p.unresolved))warnings.push('Triple empate a '+wins+' victorias: miniclasificación pendiente o no resuelta');
   ordered.push(...compared);continue;
  }
  tied.forEach(p=>{p.unresolved=true;p.criterion='Empate de '+tied.length+' participantes: falta regla oficial'});
  warnings.push('Empate de '+tied.length+' participantes a '+wins+' victorias: criterio no definido');
  ordered.push(...tied);
 }
 ordered.forEach((p,i)=>{p.position=i+1});
 const expected=names.length*(names.length-1)/2;
 return {rows:ordered,played:valid.length,expected,complete:valid.length===expected&&warnings.length===0,warnings};
}
root.CPZRanking={rankCompetition};
})(globalThis);
