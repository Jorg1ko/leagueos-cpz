/* CLUB CPZ · Vista pública de liga y próximo torneo. Sin altas ni escrituras. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const names={liga:'Liga CPZ',torneo:'Torneo de Héroes de Ebro Viejo'};
const descriptions={
 liga:'Clasificaciones individuales y de dobles, partidos disputados y próximos enfrentamientos.',
 torneo:'Estamos preparando una competición para diciembre de 2026. Fecha, formato e inscripciones aún por confirmar.'
};
let currentArea='liga';
function make(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=String(text);
 return node;
}

let selectedGroup='A';
function statsDetails(p){
 const d=make('details','tournament-info');
 const summary=make('summary','','ⓘ');
 summary.setAttribute('aria-label','Detalles de '+p.name);
 d.append(summary,make('p','', 'PJ '+p.pj+' · PG '+p.pg+' · PP '+p.pp+
  ' · Sets '+p.sf+'–'+p.sc+' (dif. '+(p.sf-p.sc)+')'+
  ' · Puntos '+p.pf+'–'+p.pc+' (dif. '+(p.pf-p.pc)+'). Posición provisional: aún no se han jugado partidos.'));
 return d;
}
function renderRanking(parent,ranking){
 const root=make('section','tournament-ranking');
 root.append(make('h5','','Clasificación'),
  make('p','tournament-explanation','0 de 6 partidos disputados · Todas las posiciones son provisionales.'));
 const tableWrap=make('div','tournament-ranking-wrap');
 const table=make('table','tournament-ranking-table');
 const head=make('thead'),hr=make('tr');
 ['#','Jugador','PJ','PG','PP','Sets F/C','Dif. sets','Puntos F/C','Dif. puntos'].forEach(label=>{
  const th=make('th','',label);th.scope='col';hr.append(th);
 });
 head.append(hr);
 const body=make('tbody');
 const mobile=make('div','tournament-ranking-mobile');
 const mobileHead=make('div','tournament-ranking-mobile-head');
 ['#','Jugador','PJ','G','P'].forEach(label=>mobileHead.append(make('span','',label)));
 mobile.append(mobileHead);
 ranking.rows.forEach((p,i)=>{
  const tr=make('tr','');
  tr.append(make('td','',i+1));
  const name=make('td','tournament-ranking-name');
  name.append(make('span','',p.name),statsDetails(p));tr.append(name);
  [p.pj,p.pg,p.pp,p.sf+'–'+p.sc,p.sf-p.sc,p.pf+'–'+p.pc,p.pf-p.pc].forEach(value=>tr.append(make('td','',value)));
  body.append(tr);
  const card=make('div','tournament-ranking-mobile-card');
  const line=make('div','tournament-ranking-mobile-row');
  [i+1,p.name,p.pj,p.pg,p.pp].forEach((value,idx)=>line.append(make('span',idx===1?'tournament-ranking-name':'',value)));
  const more=make('div','tournament-ranking-mobile-more');
  more.append(make('span','', 'Sets '+p.sf+'–'+p.sc+' · Dif. '+(p.sf-p.sc)),
   make('span','','Puntos '+p.pf+'–'+p.pc+' · Dif. '+(p.pf-p.pc)),statsDetails(p));
  card.append(line,more);mobile.append(card);
 });
 table.append(head,body);tableWrap.append(table);root.append(tableWrap,mobile);parent.append(root);
}
function renderFixtures(parent,group,games){
 const section=make('section','tournament-fixtures');
 section.append(make('h5','','Partidos y horarios'),
  make('p','tournament-explanation','Pista '+group.court+' · Turnos ficticios de 20 minutos · Día por confirmar.'));
 const list=make('ol','tournament-fixture-list');
 games.forEach(game=>{
  const row=make('li','tournament-fixture');
  const time=make('div','tournament-fixture-time');
  time.append(make('strong','',game.start),make('small','',game.end+' · Pista '+game.court));
  const names=make('div','tournament-fixture-players');
  names.append(make('strong','',game.player1),make('span','','VS'),make('strong','',game.player2));
  row.append(time,names,make('span','tournament-pending','Pendiente'));list.append(row);
 });
 section.append(list);parent.append(section);
}
function renderTournamentGroups(){
 const root=$('tournamentGroups'),select=$('tournamentGroupSelect');
 root.replaceChildren();
 const source=window.CPZ_LAB_DATA&&window.CPZ_LAB_DATA.individualGroups;
 const demo=window.CPZTournamentDemo,engine=window.CPZRanking;
 if(!source||!demo||!engine){
  root.append(make('p','tournament-error','Los grupos no están disponibles.'));return;
 }
 let groups;
 try{groups=demo.makeGroups(source)}
 catch{root.append(make('p','tournament-error','No se han podido preparar los grupos.'));return}
 select.replaceChildren();
 groups.forEach(g=>{
  const option=make('option','','Grupo '+g.label+' · Pista '+g.court);
  option.value=g.label;select.append(option);
 });
 const chosen=groups.find(g=>g.label===selectedGroup)||groups[0];
 selectedGroup=chosen.label;select.value=chosen.label;
 const panel=make('article','tournament-selected');
 const title=make('div','tournament-selected-title');
 title.append(make('h4','','Grupo '+chosen.label),make('span','','Pista '+chosen.court+' · 09:00–11:00'));
 panel.append(title);
 renderRanking(panel,engine.rankCompetition(chosen.people.map(p=>p.name),[]));
 renderFixtures(panel,chosen,demo.scheduleForGroup(chosen));
 root.append(panel);
}
function route(){
 let fragment='';
 try{fragment=decodeURIComponent((window.location.hash||'').replace(/^#\/?/,''))}
 catch{return {area:null}}
 const [first]=fragment.split('/');
 return {area:Object.prototype.hasOwnProperty.call(names,first)?first:null};
}
function showHome(){
 $('homeScreen').hidden=false;
 $('areaScreen').hidden=true;
 document.title='Club Pickleball Zaragoza · Actividades';
}
function showArea(){
 const league=currentArea==='liga';
 $('homeScreen').hidden=true;
 $('areaScreen').hidden=false;
 $('areaTitle').textContent=names[currentArea];
 $('areaDescription').textContent=descriptions[currentArea];
 $('areaEyebrow').textContent=league?'COMPETICIÓN · LIGA':'TORNEO · DICIEMBRE 2026';
 $('areaEmblem').textContent='🏆';
 $('leaguePlayer').hidden=!league;
 $('tournamentPanel').hidden=league;
 if(!league)renderTournamentGroups();
 document.title=names[currentArea]+' · Club Pickleball Zaragoza';
}
function render(){
 const next=route();
 if(!next.area){showHome();return}
 currentArea=next.area;
 showArea();
}
function navigate(area){
 const hash='#'+area;
 if(window.location.hash===hash){render();return}
 window.location.hash=hash;
}
document.querySelectorAll('[data-go]').forEach(btn=>{
 btn.addEventListener('click',()=>navigate(btn.dataset.go));
});
$('tournamentGroupSelect').addEventListener('change',event=>{selectedGroup=event.target.value;renderTournamentGroups()});
window.addEventListener('hashchange',render);
render();
})();
