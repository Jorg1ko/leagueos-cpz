'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const next=fs.readFileSync('player.html','utf8');
const previous=fs.readFileSync('docs/backup/player-original-2026-11-24.html','utf8');
assert(previous.length>15000,'Debe conservarse la versión previa');
assert(previous.includes("fetch('/api/shared/data'"),'La versión previa debe usar la misma API');
for(const id of ['overview','ranking','resultsPanel','resultType','resultGroup','allResults','bookingPanel','rulesPanel','logout','refreshRankings','labDataNotice'])
 assert(next.includes('id="'+id+'"'),'Función conservada: '+id);
for(const name of ['individual','doubles','results','booking','rules'])
 assert(next.includes('data-page="'+name+'"'),'Pestaña conservada: '+name);
for(const value of ['RANKINGINDNOV26','RANKINGDOBNOV26','https://pickleballzaragoza.taykus.com/bookingtypes','reglas-oficiales-de-pickleball-2026.pdf'])
 assert(next.includes(value),'Reserva, código o regla conservados: '+value);
assert(next.includes("fetch('/api/shared/data',{method:'GET',credentials:'same-origin',cache:'no-store'})"),'Solo datos reales autenticados');
assert(next.includes("fetch('/api/shared/logout'"),'Salir debe cerrar la sesión compartida');
assert(next.includes('CPZLabFeatures.pendingMatches'),'Cruces pendientes');
assert(next.includes('mobile-standings')&&next.includes('match-set-line'),'Clasificaciones móviles y resultados por set');
assert(next.includes('ranking-status')&&next.includes('standing-explain'),'Progreso y explicación de clasificación');
assert(next.includes('renderAll()'),'Pestaña con todos los resultados');
assert(next.includes('copyDiscountCode'),'Código de reservas copiable');
assert(!next.includes('window.CPZ_LAB_DATA')&&!next.includes('window.CPZ_LAB_RESULTS'),'No utilizar copia estática');
assert(!next.includes('./lab-results.js')&&!next.includes('./lab-data.js'),'No depender de archivos del laboratorio');
assert(!next.includes('LABORATORIO SIN CONTRASEÑA')&&!next.includes('✦ LABORATORIO'),'No publicar maqueta sin autenticación');
assert(next.includes('/ranking-engine.js'),'Motor de clasificación original');
const inline=[...next.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
assert.equal(inline.length,2,'Un módulo puro y una aplicación principal');
for(const source of inline)new vm.Script(source);
assert(next.includes('grid-template-columns:repeat(5,minmax(0,1fr))'),'Cinco secciones accesibles en móvil');
console.log('OK: liga visual nueva con datos en vivo, cinco vistas y recursos existentes preservados');
