/* Solo simulador de inscripciones para el laboratorio público. Sin servidor ni autenticación. */
(function(root){
 'use strict';
 const keys=['martes','jueves'];
 const weekdays={martes:2,jueves:4};
 const normalized=name=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
 const cleanName=value=>String(value||'').replace(/\s+/g,' ').trim();
 function emptyState(){return {version:1,martes:{date:'',time:'',people:[]},jueves:{date:'',time:'',people:[]}};}
 function validDay(key,date){
  if(!keys.includes(key)||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const d=new Date(date+'T12:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===date&&d.getUTCDay()===weekdays[key];
 }
 function readState(raw){
  let input;try{input=typeof raw==='string'?JSON.parse(raw):raw}catch{return emptyState()}
  const base=emptyState();
  if(!input||typeof input!=='object')return base;
  for(const key of keys){
   const item=input[key];
   if(!item||!validDay(key,item.date))continue;
   base[key].date=item.date;
   base[key].time=typeof item.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)?item.time:'';
   const seen=new Set();
   for(const p of Array.isArray(item.people)?item.people:[]){
    const name=cleanName(p?.name);
    if(name.length<2||name.length>70||seen.has(normalized(name)))continue;
    seen.add(normalized(name));
    if(base[key].people.length<80)base[key].people.push({name});
   }
  }
  return base;
 }
 function setSession(input,key,date,time=''){
  const state=readState(input);
  if(!validDay(key,date))throw Error(key==='martes'?'Selecciona una fecha que sea martes.':'Selecciona una fecha que sea jueves.');
  if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('La hora debe tener formato HH:MM.');
  const previous=state[key];
  state[key]={date,time,people:previous.date===date?previous.people:[]};
  return state;
 }
 function signUp(input,key,rawName){
  const state=readState(input);
  const session=state[key];
  if(!session||!session.date)throw Error('Todavía no se ha publicado una fecha para esta sesión.');
  const name=cleanName(rawName);
  if(name.length<2||name.length>70)throw Error('Escribe tu nombre, entre 2 y 70 caracteres.');
  if(session.people.some(p=>normalized(p.name)===normalized(name)))throw Error('Este nombre ya está apuntado a esta sesión.');
  if(session.people.length>=80)throw Error('La lista de demostración está completa.');
  session.people.push({name});
  return state;
 }
 function removePerson(input,key,name){
  const state=readState(input);
  if(!state[key])throw Error('Actividad no válida');
  state[key].people=state[key].people.filter(p=>normalized(p.name)!==normalized(name));
  return state;
 }
 root.CPZClubDemo={emptyState,readState,validDay,setSession,signUp,removePerson};
})(globalThis);
