/* CLUB CPZ · Vista pública de liga y próximo torneo. Sin altas ni escrituras. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const names={liga:'Liga CPZ',torneo:'CPZ Open'};
const descriptions={
 liga:'Clasificaciones individuales y de dobles, partidos disputados y próximos enfrentamientos.',
 torneo:'Torneo del 12 de diciembre de 2026. Grupos, enfrentamientos y cuadros de ejemplo; inscripciones pendientes.'
};
let currentArea='liga';
function make(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=String(text);
 return node;
}


let tvOpen=false;
function getFirstWave(){
 const source=window.CPZ_LAB_DATA&&window.CPZ_LAB_DATA.individualGroups;
 const model=window.CPZTournamentDemo;
 if(!source||!model||typeof model.firstWave!=='function')return null;
 try{return model.firstWave(source)}
 catch{return null}
}
function matchCard(game,isTv){
 const card=make(isTv?'article':'button',isTv?'tv-match':'upcoming-match');
 if(!isTv){
  card.type='button';card.setAttribute('aria-label','Ver en TV la pista '+game.court+
  ', '+game.player1+' contra '+game.player2);
  card.addEventListener('click',openTvBoard);
 }
 const header=make('div',isTv?'tv-match-top':'upcoming-match-top');
 header.append(make('strong','', 'PISTA '+game.court),make('span','', 'GRUPO '+game.groupLabel));
 const pairing=make('div',isTv?'tv-match-players':'upcoming-match-players');
 pairing.append(make('strong','',game.player1),make('span','','VS'),make('strong','',game.player2));
 const time=make('span',isTv?'tv-match-time':'upcoming-match-time','09:00 – 09:20');
 card.append(header,pairing,time);
 return card;
}
function renderUpcoming(){
 const games=getFirstWave();
 const home=$('upcomingMatches'),tv=$('tvMatches');
 home.replaceChildren();tv.replaceChildren();
 if(!games||games.length!==7){
  home.append(make('p','tournament-error','No se ha podido cargar el calendario de ejemplo.'));
  $('openTvBoard').disabled=true;
  return false;
 }
 $('openTvBoard').disabled=false;
 games.forEach(game=>{
  home.append(matchCard(game,false));
  tv.append(matchCard(game,true));
 });
 return true;
}
function closeTvBoard(){
 const board=$('tvBoard');
 tvOpen=false;
 board.hidden=true;
 document.body.classList.remove('tv-mode-open');
 if(document.fullscreenElement===board&&typeof document.exitFullscreen==='function'){
  Promise.resolve(document.exitFullscreen()).catch(()=>{});
 }
 $('openTvBoard').focus({preventScroll:true});
}
function openTvBoard(){
 if(!renderUpcoming())return;
 const board=$('tvBoard');
 board.hidden=false;tvOpen=true;
 document.body.classList.add('tv-mode-open');
 board.focus({preventScroll:true});
 // El navegador solo permite pantalla completa tras interacción del visitante.
 if(typeof board.requestFullscreen==='function'){
  Promise.resolve(board.requestFullscreen()).catch(()=>{});
 }
}
$('openTvBoard').addEventListener('click',openTvBoard);
$('closeTvBoard').addEventListener('click',closeTvBoard);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&tvOpen)closeTvBoard();
});
document.addEventListener('fullscreenchange',()=>{
 if(tvOpen&&!document.fullscreenElement)closeTvBoard();
});

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
  make('p','tournament-explanation','Pista '+group.court+' · 12 de diciembre de 2026 · Turnos ficticios de 20 minutos.'));
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

let selectedBracket='championship';
function formatPlace(number){return number+'.º'}
function renderTournamentPlacements(){
 const root=$('tournamentPlacementList');
 root.replaceChildren();
 const model=window.CPZTournamentBrackets;
 if(!model){root.append(make('p','tournament-error','Clasificación no disponible.'));return}
 for(const mode of ['championship','consolation']){
  const bracket=model.makeBracket(mode);
  const section=make('section','knockout-placement-column');
  section.append(make('h4','',bracket.name));
  const list=make('ol','knockout-placement-list');
  list.start=bracket.positions[0];
  bracket.positions.forEach(rank=>{
   const item=make('li','');
   item.value=rank;
   item.append(make('strong','',formatPlace(rank)),make('span','','Pendiente'));
   list.append(item);
  });
  section.append(list);root.append(section);
 }
}
function renderTournamentBracket(){
 const root=$('tournamentBracket');
 root.replaceChildren();
 const generator=window.CPZTournamentBrackets;
 if(!generator){root.append(make('p','tournament-error','El cuadro no está disponible.'));return}
 let bracket;
 try{bracket=generator.makeBracket(selectedBracket)}
 catch{root.append(make('p','tournament-error','No se han podido preparar las eliminatorias.'));return}
 document.querySelectorAll('[data-bracket]').forEach(button=>{
  const active=button.dataset.bracket===selectedBracket;
  button.classList.toggle('is-active',active);
  button.setAttribute('aria-pressed',String(active));
 });
 const header=make('div','knockout-selected-header');
 header.append(make('h4','',bracket.name),make('span','',bracket.description));
 root.append(header);
 bracket.rounds.forEach(round=>{
  const block=make('details','knockout-round');
  block.open=['quarter','medals'].includes(round.id);
  const summary=make('summary','knockout-round-summary');
  summary.append(make('strong','',round.title),make('span','',round.matches.length+' partidos'));
  block.append(summary,make('p','knockout-round-desc',round.description));
  const matchList=make('div','knockout-match-grid');
  round.matches.forEach(game=>{
   const card=make('article','knockout-match');
   const heading=make('div','knockout-match-head');
   heading.append(make('span','knockout-match-id','Partido '+game.id));
   if('winnerPosition' in game){
    heading.append(make('span','knockout-match-place',
      formatPlace(game.winnerPosition)+' / '+formatPlace(game.loserPosition)));
   }else heading.append(make('span','knockout-match-state','Pendiente'));
   const players=make('div','knockout-match-players');
   players.append(make('div','knockout-match-slot',game.slot1),
                  make('span','knockout-match-vs','VS'),
                  make('div','knockout-match-slot',game.slot2));
   card.append(heading,players);
   matchList.append(card);
  });
  block.append(matchList);
  root.append(block);
 });
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
 $('areaEyebrow').textContent=league?'COMPETICIÓN · LIGA':'CPZ OPEN · 12 DIC 2026';
 $('areaEmblem').textContent='🏆';
 $('leaguePlayer').hidden=!league;
 $('tournamentPanel').hidden=league;
 if(!league){renderUpcoming();renderTournamentGroups();renderTournamentBracket();renderTournamentPlacements();}
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
document.querySelectorAll('[data-bracket]').forEach(button=>button.addEventListener('click',()=>{
 selectedBracket=button.dataset.bracket;
 renderTournamentBracket();
}));
window.addEventListener('hashchange',render);
render();
})();
