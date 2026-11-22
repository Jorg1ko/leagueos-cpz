/* CLUB CPZ · Laboratorio de interfaz. Datos de prueba locales, nunca D1. */
(function(){
'use strict';
const model=window.CPZClubDemo;
if(!model)throw new Error('No se ha cargado el modelo de actividades del laboratorio');
const $=id=>document.getElementById(id);
const STORE='cpz-club-lab-dropins-demo-v1';
const names={liga:'Liga CPZ',martes:'Drop-in martes',jueves:'Drop-in jueves'};
const descriptions={
 liga:'Clasificaciones individuales y de dobles, partidos disputados y próximos enfrentamientos.',
 martes:'Una actividad del club para apuntarte y jugar los martes.',
 jueves:'Una actividad del club para apuntarte y jugar los jueves.'
};
let state;
try{state=model.readState(window.localStorage.getItem(STORE))}
catch{state=model.emptyState()}
let currentArea='liga',currentRole='jugador';

function commit(updated){
 try{
  window.localStorage.setItem(STORE,JSON.stringify(updated));
  state=updated;return true;
 }catch{
  return false;
 }
}
function make(tag,className,text){
 const e=document.createElement(tag);
 if(className)e.className=className;
 if(text!==undefined)e.textContent=String(text);
 return e;
}
function formatDate(date){
 if(!date)return 'Fecha por publicar';
 const d=new Date(date+'T12:00:00');
 if(Number.isNaN(d.getTime()))return 'Fecha por publicar';
 return new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
}
function countText(n){return n===1?'1 persona apuntada':n+' personas apuntadas'}
function route(){
 const fragment=decodeURIComponent((window.location.hash||'').replace(/^#\/?/,''));
 const [first,role]=fragment.split('/');
 return {area:names[first]?first:null,role:role==='admin'?'admin':'jugador'};
}
function showFeedback(id,message,error=false){
 const node=$(id);node.textContent=message;node.classList.toggle('is-error',error);
}
function showHome(){
 $('homeScreen').hidden=false;
 $('areaScreen').hidden=true;
 $('homeTuesdayDate').textContent=state.martes.date?formatDate(state.martes.date):'Fecha por publicar';
 $('homeThursdayDate').textContent=state.jueves.date?formatDate(state.jueves.date):'Fecha por publicar';
 document.title='Club Pickleball Zaragoza · Espacio del club (laboratorio)';
}
function renderAttendees(target,people,admin){
 const root=$(target);root.replaceChildren();
 if(!people.length){
  root.append(make('div','attendee-empty','Todavía no hay ninguna persona apuntada en este dispositivo.'));
  return;
 }
 people.forEach((p,i)=>{
  const row=make('div','attendee-row');
  const identity=make('span','attendee-identity');
  identity.append(make('span','attendee-number',i+1),make('span','',p.name));
  row.append(identity);
  if(admin){
   const remove=make('button','remove-person','Quitar');
   remove.type='button';remove.dataset.removeName=p.name;
   remove.setAttribute('aria-label','Quitar a '+p.name+' de la sesión de prueba');
   row.append(remove);
  }
  root.append(row);
 });
}
function showArea(){
 $('homeScreen').hidden=true;
 $('areaScreen').hidden=false;
 $('areaTitle').textContent=names[currentArea];
 $('areaDescription').textContent=descriptions[currentArea];
 $('areaEyebrow').textContent=currentArea==='liga'?'COMPETICIÓN':'ACTIVIDAD · INSCRIPCIÓN';
 $('areaEmblem').textContent=currentArea==='liga'?'🏆':currentArea==='martes'?'📅':'🏓';
 $('playerRole').classList.toggle('is-active',currentRole==='jugador');
 $('adminRole').classList.toggle('is-active',currentRole==='admin');
 $('playerRole').setAttribute('aria-pressed',String(currentRole==='jugador'));
 $('adminRole').setAttribute('aria-pressed',String(currentRole==='admin'));
 const league=currentArea==='liga',player=currentRole==='jugador';
 $('leaguePlayer').hidden=!(league&&player);
 $('leagueAdmin').hidden=!(league&&!player);
 $('dropPlayer').hidden=league||!player;
 $('dropAdmin').hidden=league||player;
 document.title=names[currentArea]+' · Club Pickleball Zaragoza (laboratorio)';
 if(league)return;

 const session=state[currentArea];
 $('sessionDate').textContent=formatDate(session.date);
 $('sessionTime').textContent=!session.date?'El administrador todavía no ha publicado una fecha.':session.time?'Hora de inicio: '+session.time:'Hora pendiente de confirmar';
 $('sessionCount').textContent=countText(session.people.length);
 $('attendeeCount').textContent=session.people.length;
 $('adminAttendeeCount').textContent=session.people.length;
 $('signupButton').disabled=!session.date;
 $('playerName').disabled=!session.date;
 $('playerName').placeholder=session.date?'Nombre y apellidos':'Pendiente de publicar fecha';
 renderAttendees('attendeeList',session.people,false);
 renderAttendees('adminAttendeeList',session.people,true);
 $('sessionDateInput').value=session.date;
 $('sessionTimeInput').value=session.time;
 if(!session.date&&!player)showFeedback('adminFeedback','Selecciona un '+currentArea+' y publica una fecha para comenzar.');
 else if(!session.date)showFeedback('signupFeedback','El formulario se activará cuando se publique una fecha.');
}
function render(){
 const next=route();
 if(!next.area){showHome();return}
 currentArea=next.area;currentRole=next.role;
 showArea();
}
function navigate(area,role='jugador'){
 window.location.hash='#'+area+'/'+role;
 if(route().area===area&&route().role===role)render();
}
document.querySelectorAll('[data-go]').forEach(btn=>{
 btn.addEventListener('click',()=>navigate(btn.dataset.go));
});
document.querySelectorAll('[data-role]').forEach(btn=>{
 btn.addEventListener('click',()=>navigate(currentArea,btn.dataset.role));
});
$('signupForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(!['martes','jueves'].includes(currentArea))return;
 try{
  const name=$('playerName').value;
  const updated=model.signUp(state,currentArea,name);
  if(!commit(updated)){showFeedback('signupFeedback','No se ha podido guardar en este navegador. Comprueba sus permisos de almacenamiento.',true);return}
  $('playerName').value='';
  showArea();
  showFeedback('signupFeedback','Nombre guardado en esta demostración. Solo es visible desde este navegador.');
 }catch(error){
  showFeedback('signupFeedback',error.message,true);
 }
});
$('sessionForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(!['martes','jueves'].includes(currentArea))return;
 const date=$('sessionDateInput').value,time=$('sessionTimeInput').value;
 const session=state[currentArea];
 if(session.date&&session.date!==date&&session.people.length&&!window.confirm('Al cambiar la fecha se empezará una lista nueva. ¿Continuar?'))return;
 try{
  const updated=model.setSession(state,currentArea,date,time);
  if(!commit(updated)){showFeedback('adminFeedback','No se ha podido guardar en este navegador.',true);return}
  showArea();
  showFeedback('adminFeedback','Fecha publicada en esta simulación. Solo está guardada en este navegador.');
 }catch(error){
  showFeedback('adminFeedback',error.message,true);
 }
});
$('adminAttendeeList').addEventListener('click',event=>{
 const button=event.target.closest('button[data-remove-name]');
 if(!button||!['martes','jueves'].includes(currentArea))return;
 const name=button.dataset.removeName;
 if(!window.confirm('¿Quitar a '+name+' de esta lista de demostración?'))return;
 const updated=model.removePerson(state,currentArea,name);
 if(commit(updated)){showArea();showFeedback('adminFeedback',name+' eliminado de la lista de prueba.')}
 else showFeedback('adminFeedback','No se ha podido guardar el cambio en este navegador.',true);
});
window.addEventListener('hashchange',render);
render();
})();
