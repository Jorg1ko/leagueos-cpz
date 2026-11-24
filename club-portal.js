/* CLUB CPZ · Laboratorio estático. Liga de consulta y próximo torneo provisional. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const names={liga:'Liga CPZ',torneo:'Torneo de Héroes de Ebro Viejo'};
const descriptions={
 liga:'Clasificaciones individuales y de dobles, partidos disputados y próximos enfrentamientos.',
 torneo:'Estamos preparando una competición para diciembre de 2026. Fecha, formato e inscripciones aún por confirmar.'
};
let currentArea='liga',currentRole='jugador';
function route(){
 let fragment='';
 try{fragment=decodeURIComponent((window.location.hash||'').replace(/^#\/?/,''))}
 catch{return {area:null,role:'jugador'}}
 const [first,role]=fragment.split('/');
 return {area:Object.prototype.hasOwnProperty.call(names,first)?first:null,role:first==='liga'&&role==='admin'?'admin':'jugador'};
}
function showHome(){
 $('homeScreen').hidden=false;
 $('areaScreen').hidden=true;
 document.title='Club Pickleball Zaragoza · Espacio del club (laboratorio)';
}
function showArea(){
 const league=currentArea==='liga',player=currentRole==='jugador';
 $('homeScreen').hidden=true;
 $('areaScreen').hidden=false;
 $('areaTitle').textContent=names[currentArea];
 $('areaDescription').textContent=descriptions[currentArea];
 $('areaEyebrow').textContent=league?'COMPETICIÓN · LIGA':'TORNEO · DICIEMBRE 2026';
 $('areaEmblem').textContent='🏆';
 $('roleSwitch').hidden=!league;
 $('playerRole').classList.toggle('is-active',player);
 $('adminRole').classList.toggle('is-active',!player);
 $('playerRole').setAttribute('aria-pressed',String(player));
 $('adminRole').setAttribute('aria-pressed',String(!player));
 $('leaguePlayer').hidden=!(league&&player);
 $('leagueAdmin').hidden=!(league&&!player);
 $('tournamentPanel').hidden=league;
 document.title=names[currentArea]+' · Club Pickleball Zaragoza (laboratorio)';
}
function render(){
 const next=route();
 if(!next.area){showHome();return}
 currentArea=next.area;
 currentRole=next.role;
 showArea();
}
function navigate(area,role='jugador'){
 const hash='#'+area+(area==='liga'?'/'+role:'');
 if(window.location.hash===hash){render();return}
 window.location.hash=hash;
}
document.querySelectorAll('[data-go]').forEach(btn=>{
 btn.addEventListener('click',()=>navigate(btn.dataset.go));
});
document.querySelectorAll('[data-role]').forEach(btn=>{
 btn.addEventListener('click',()=>navigate(currentArea,btn.dataset.role));
});
window.addEventListener('hashchange',render);
render();
})();
