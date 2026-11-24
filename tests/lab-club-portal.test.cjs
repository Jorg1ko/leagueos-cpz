'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const home=fs.readFileSync('club-portal.html','utf8');
const league=fs.readFileSync('player.html','utf8');
const js=fs.readFileSync('club-portal.js','utf8');
const css=fs.readFileSync('club-portal.css','utf8');
const workflow=fs.readFileSync('.github/workflows/laboratorio-movil.yml','utf8');

for(const tag of ['id="homeScreen"','id="areaScreen"','data-go="liga"','data-go="torneo"','id="leaguePlayer"','id="leagueAdmin"','id="tournamentPanel"','id="roleSwitch"']){
 assert(home.includes(tag),'Falta función de club: '+tag);
}
assert(home.includes('Torneo de Héroes de Ebro Viejo'),'Nombre provisional del torneo');
assert(home.includes('Diciembre 2026')&&home.includes('Diciembre de 2026'),'El torneo está previsto para diciembre de 2026');
assert(home.includes('Aún no abiertas')&&home.includes('Día y horario por confirmar'),'No deben anunciarse fechas ni inscripciones inventadas');
assert(!/drop.?in|dropPlayer|dropAdmin|signupForm|sessionForm|homeTuesdayDate|homeThursdayDate|data-go="martes"|data-go="jueves"/i.test(home),'Los Drop-ins ya no deben figurar en la vista');
assert(!/drop.?in|localStorage|signupForm|sessionForm|fetch\(|XMLHttpRequest|\/api\//i.test(js),'El portal es solo informativo, sin altas ni acceso a API');
assert(!js.includes('innerHTML'),'Evitar inserción de HTML dinámico');
assert(!/<form\b/i.test(home),'No se recogerán inscripciones ni datos de visitantes');
assert(!home.includes('club-portal-model.js')&&!workflow.includes('club-portal-model.js'),'Modelo antiguo no desplegado');
assert(home.includes('href="./liga.html"'),'La liga sigue accesible');
assert(league.includes('href="./" aria-label="Volver al inicio'),'La liga debe enlazar al portal');
assert(home.includes('disabled>'),'La contraseña demo de administración no puede activarse');
assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'Portada con dos actividades');
assert(css.includes('.service-card.tournament-card .service-top'),'Tarjeta del torneo con imagen');
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
console.log('OK: liga conservada, torneo provisional diciembre, sin Drop-ins ni formularios, móvil y modo oscuro');
