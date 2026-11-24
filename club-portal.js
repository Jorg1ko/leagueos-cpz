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
function renderTournamentGroups(){
 const container=$('tournamentGroups');
 container.replaceChildren();
 const data=window.CPZ_LAB_DATA&&window.CPZ_LAB_DATA.individualGroups;
 const generator=window.CPZTournamentDemo;
 if(!generator||!data){
  container.append(make('p','tournament-error','No se ha podido cargar la plantilla de referencia.'));
  return;
 }
 let groups;
 try{groups=generator.makeGroups(data)}
 catch{
  container.append(make('p','tournament-error','No se ha podido preparar la simulación de grupos.'));
  return;
 }
 groups.forEach(group=>{
  const card=make('section','tournament-group-card');
  card.setAttribute('aria-label','Grupo '+group.label);
  const top=make('div','tournament-group-top');
  top.append(make('h4','','Grupo '+group.label),make('span','tournament-group-size','4 personas'));
  card.append(top);
  const list=make('ol','tournament-people');
  group.people.forEach(person=>{
   const item=make('li','tournament-person');
   item.append(make('span','tournament-person-name',person.name));
   list.append(item);
  });
  card.append(list);
  container.append(card);
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
window.addEventListener('hashchange',render);
render();
})();
