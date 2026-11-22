'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const sandbox={};
vm.runInNewContext(fs.readFileSync('club-portal-model.js','utf8'),sandbox);
const model=sandbox.CPZClubDemo;
assert(model, 'No club module');
const empty=model.emptyState();
assert.equal(empty.martes.date,'');
assert.equal(empty.jueves.people.length,0);
assert.equal(model.validDay('martes','2026-11-24'),true);
assert.equal(model.validDay('jueves','2026-11-26'),true);
assert.equal(model.validDay('martes','2026-11-26'),false);
assert.equal(model.validDay('jueves','2026-11-24'),false);
assert.equal(model.validDay('martes','2026-02-30'),false);
assert.throws(()=>model.setSession(empty,'martes','2026-11-26'),/martes/);
assert.throws(()=>model.signUp(empty,'martes','Ana'),/publicado/);

let state=model.setSession(empty,'martes','2026-11-24','18:30');
assert.equal(state.martes.date,'2026-11-24');
assert.equal(state.martes.time,'18:30');
assert.equal(state.jueves.date,'');
state=model.signUp(state,'martes','  Álvaro   García  ');
assert.equal(state.martes.people[0].name,'Álvaro García');
assert.throws(()=>model.signUp(state,'martes',' alvaro garcia '),/ya está apuntado/);
assert.throws(()=>model.signUp(state,'martes',' '),/nombre/);
state=model.signUp(state,'martes','Ana Martín');
assert.equal(state.martes.people.length,2);
let other=model.setSession(state,'jueves','2026-11-26');
other=model.signUp(other,'jueves','Javier Pérez');
assert.equal(other.martes.people.length,2);
assert.equal(other.jueves.people.length,1);
other=model.setSession(other,'martes','2026-12-01');
assert.equal(other.martes.people.length,0,'New day must have new attendance list');
assert.equal(other.jueves.people.length,1,'Other day must remain untouched');
other=model.removePerson(other,'jueves','JAVIER PÉREZ');
assert.equal(other.jueves.people.length,0);
assert.equal(model.readState('{broken').martes.date,'','Corrupt browser storage must recover');
assert.equal(model.readState(JSON.stringify(state)).martes.people.length,2,'Local saved state restores');
assert.equal(model.setSession(state,'martes','2026-11-24','19:00').martes.people.length,2,'Changing just time keeps signups');

const home=fs.readFileSync('club-portal.html','utf8');
const league=fs.readFileSync('player.html','utf8');
const js=fs.readFileSync('club-portal.js','utf8');
const css=fs.readFileSync('club-portal.css','utf8');

for(const tag of ['id="homeScreen"','id="areaScreen"','data-go="liga"','data-go="martes"','data-go="jueves"','id="leaguePlayer"','id="leagueAdmin"','id="dropPlayer"','id="dropAdmin"','id="signupForm"','id="sessionForm"','id="sessionDateInput"','id="playerName"']){
 assert(home.includes(tag),'Missing club feature: '+tag);
}
assert(home.includes('href="./liga.html"'),'Existing league must remain reachable');
assert(league.includes('href="./" aria-label="Volver al inicio'),'Existing league must link back to hub');
assert(home.includes('solo se guardan en este navegador'),'Prototype must disclose local-only data');
assert(home.includes('disabled>'),'Admin password must be demonstrably inactive');
assert(!/fetch\(|XMLHttpRequest|\/api\//.test(js),'Drop-in preview must not call production APIs');
assert(!js.includes('innerHTML'),'Display user-submitted names via safe textContent, not HTML');
assert(!htmlHasExternalForms(home),'All signup data should stay on device');
assert(css.includes('@media(max-width:700px)'),'Mobile first layout required');

const photoNames=['pistas-cpz.jpg','partidos-cpz.jpg','alquiler-cpz.jpg','clases-cpz.jpg','escudo-cpz.webp'];
for(const filename of photoNames){
 assert(fs.existsSync('lab-assets/'+filename),'Falta archivo local '+filename);
 const blob=fs.readFileSync('lab-assets/'+filename);
 assert(blob.length>2000,'Foto local vacía '+filename);
 assert(filename.endsWith('.webp')?blob.toString('ascii',0,4)==='RIFF':blob[0]===255&&blob[1]===216,'Archivo de imagen no válido '+filename);
 if(filename.endsWith('.jpg'))assert(css.includes('./lab-assets/'+filename),'No se utiliza la foto local '+filename);
}
assert(home.includes('./lab-assets/escudo-cpz.webp')&&league.includes('./lab-assets/escudo-cpz.webp'),'Escudo local en ambas vistas');
assert(!css.includes('clubpickleballzaragoza.com/wp-content/uploads/'),'No debe depender de fotos remotas');
assert(css.includes('prefers-color-scheme:dark'),'Portada sin modo oscuro automático');
assert(css.includes('.hero{')&&css.includes('background-image:linear-gradient('),'El fondo del hero necesita un degradado para mantener legibilidad');
assert(css.includes('.service-card.drop-card:nth-child(2) .service-top')&&css.includes('.service-card.drop-card:nth-child(3) .service-top'),'Los dos drop-in deben tener fotografías distintas');

new vm.Script(js);
console.log('OK: portal, liga, martes/jueves, alta manual, administrador de prueba, fechas y persistencia local');

function htmlHasExternalForms(html){
 return /<form\b[^>]*\baction\s*=\s*["']https?:/i.test(html);
}
