/* Utilidades puras para la vista aislada CPZ. No accede a producción. */
(function(root){
 'use strict';
 const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');

 function validSets(sets){
  if(!Array.isArray(sets)||(sets.length!==2&&sets.length!==3))return false;
  let a=0,b=0;
  for(const score of sets){
   if(!Array.isArray(score)||score.length!==2||!score.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=99)||score[0]===score[1])return false;
   if(score[0]>score[1])a++;else b++;
  }
  return Math.max(a,b)===2&&a!==b;
 }

 function pendingMatches(people,matches){
  const participants=Array.isArray(people)?people:[];
  const lookup=new Map(participants.map((name,i)=>[norm(name),i]));
  const played=new Set();
  for(const game of matches||[]){
   const a=lookup.get(norm(game.player1)),b=lookup.get(norm(game.player2));
   if(a===undefined||b===undefined||a===b||!validSets(game.sets))continue;
   played.add([a,b].sort((x,y)=>x-y).join(':'));
  }
  const pending=[];
  for(let a=0;a<participants.length;a++){
   for(let b=a+1;b<participants.length;b++){
    if(!played.has(a+':'+b))pending.push({player1:participants[a],player2:participants[b]});
   }
  }
  return {pending,played:played.size,expected:participants.length*(participants.length-1)/2};
 }

 function searchParticipants(data,query,limit=12){
  const term=norm(query);
  if(term.length<2||!data)return [];
  const result=[];
  for(const [mode,groups] of [['individual',data.individualGroups],['doubles',data.doublesGroups]]){
   for(const [group,people] of Object.entries(groups||{})){
    for(const item of people){
     const members=Array.isArray(item)?item:[item];
     const name=members.join(' / ');
     const keys=[name,...members].map(norm);
     if(!keys.some(key=>key.includes(term)))continue;
     const score=keys.some(key=>key.startsWith(term))?0:1;
     result.push({mode,group,name,members,score});
    }
   }
  }
  result.sort((a,b)=>a.score-b.score||(a.mode===b.mode?0:a.mode==='individual'?-1:1)||a.group.localeCompare(b.group,'es')||a.name.localeCompare(b.name,'es'));
  return result.slice(0,limit);
 }
 root.CPZLabFeatures={pendingMatches,searchParticipants,validSets};
})(globalThis);
