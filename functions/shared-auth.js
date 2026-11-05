// Acceso de lectura compartido. La clave se configura por un administrador.
export const SHARED_COOKIE='__Host-cpz_readonly';
const te=new TextEncoder(),MAX_AGE=8*60*60;
export async function ensureShared(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS cpz_shared_access (id INTEGER PRIMARY KEY CHECK(id=1),salt TEXT NOT NULL,hash TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
const toB64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromB64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function sign(secret,message){
 const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return toB64(new Uint8Array(await crypto.subtle.sign('HMAC',key,te.encode(message))));
}
export async function hashPassword(password,salt){
 const material=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveBits']);
 return toB64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromB64(salt),iterations:100000},material,256)));
}
export function newSalt(){return toB64(crypto.getRandomValues(new Uint8Array(24)))}
export function validPassword(password){return typeof password==='string'&&password.length>=12&&password.length<=128}
export async function sharedCookie(secret,version){
 const expiry=Date.now()+MAX_AGE*1000,part='1.'+version+'.'+expiry,signature=await sign(secret,'CPZ_READONLY|'+part);
 return SHARED_COOKIE+'='+part+'.'+signature+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+MAX_AGE;
}
export const clearSharedCookie=()=>SHARED_COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
export async function sharedSession(request,env){
 if(!env.LEAGUE_DB||typeof env.ADMIN_PASSWORD!=='string'||env.ADMIN_PASSWORD.length<12)return false;
 const cookie=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(SHARED_COOKIE+'='));
 if(!cookie)return false;
 const parts=cookie.slice(SHARED_COOKIE.length+1).split('.');
 if(parts.length!==4||parts[0]!=='1'||!/^[0-9]{13}$/.test(parts[2]))return false;
 const version=Number(parts[1]),expiry=Number(parts[2]);
 if(!Number.isSafeInteger(version)||version<1||expiry<Date.now()||expiry>Date.now()+MAX_AGE*1000)return false;
 const expected=await sign(env.ADMIN_PASSWORD,'CPZ_READONLY|'+parts.slice(0,3).join('.'));
 const a=te.encode(expected),b=te.encode(parts[3]);
 if(a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 if(diff!==0)return false;
 try{const db=env.LEAGUE_DB;await ensureShared(db);const state=await db.prepare('SELECT version FROM cpz_shared_access WHERE id=1').first();return state?.version===version}catch{return false}
}
