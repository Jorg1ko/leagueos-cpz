// Legal settings for the private CPZ 2026/27 ranking.
// Public GET only exposes information that was explicitly approved by the organizer.
// POST is admin-only; no made-up identity, contact or legal basis is published.
const COOKIE='__Host-leagueos_admin',AGE=8*60*60,te=new TextEncoder();
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function authorized(request,secret){
  if(typeof secret!=='string'||secret.length<12)return false;
  const part=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  if(!part)return false;
  const p=part.slice(COOKIE.length+1).split('.');
  if(p.length!==4||p[0]!=='1'||!/^[0-9]{13}$/.test(p[1]))return false;
  const expires=Number(p[1]);
  if(expires<Date.now()||expires>Date.now()+AGE*1000)return false;
  try{
    const raw=p[3].replace(/-/g,'+').replace(/_/g,'/');
    const bytes=Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    return await crypto.subtle.verify('HMAC',key,bytes,te.encode(p.slice(0,3).join('.')));
  }catch{return false}
}
async function schema(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS cpz_legal_settings (id INTEGER PRIMARY KEY CHECK (id=1), responsible_name TEXT NOT NULL DEFAULT '', contact_email TEXT NOT NULL DEFAULT '', postal_address TEXT NOT NULL DEFAULT '', retention_note TEXT NOT NULL DEFAULT '', legal_basis TEXT NOT NULL DEFAULT '', approved INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
function textField(v,max){
  if(typeof v!=='string'||v.length>max)return null;
  const out=v.trim();
  return out.length>=4&&!/[<>\u0000-\u001f]/.test(out)?out:null;
}
export async function onRequest({request,env}){
  try{
    if(!env.LEAGUE_DB)return json({ok:false,error:'Base de datos no configurada'},503);
    if(!['GET','POST'].includes(request.method))return json({ok:false,error:'Método no permitido'},405);
    await schema(env.LEAGUE_DB);
    const isAdmin=await authorized(request,env.ADMIN_PASSWORD);
    const row=await env.LEAGUE_DB.prepare('SELECT responsible_name AS responsibleName,contact_email AS contactEmail,postal_address AS postalAddress,retention_note AS retentionNote,legal_basis AS legalBasis,approved,revision,updated_at AS updatedAt FROM cpz_legal_settings WHERE id=1').first();
    if(request.method==='GET'){
      const approved=row?.approved===1;
      if(approved||isAdmin&&new URL(request.url).searchParams.get('draft')==='1')
        return json({ok:true,approved,revision:row?.revision||0,settings:row||null});
      return json({ok:true,approved:false,revision:0,settings:null});
    }
    if(!isAdmin)return json({ok:false,error:'Solo el administrador puede modificar la información legal.'},401);
    const base=new URL(request.url).origin;
    const origin=request.headers.get('Origin');
    if((request.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase()!=='application/json'||
       origin!==base)return json({ok:false,error:'Origen incorrecto'},403);
    const raw=await request.text();
    if(raw.length>4500)return json({ok:false,error:'Solicitud demasiado grande'},413);
    const body=JSON.parse(raw);
    const name=textField(body.responsibleName,180);
    const email=typeof body.contactEmail==='string'&&body.contactEmail.length<=160?body.contactEmail.trim().toLowerCase():null;
    const address=textField(body.postalAddress,320);
    const retention=textField(body.retentionNote,550);
    const basis=textField(body.legalBasis,600);
    if(body.confirmAuthorized!==true||!name||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||!address||!retention||!basis)
      return json({ok:false,error:'El responsable debe validar identidad, correo, dirección, base jurídica y conservación antes de publicar.'},400);
    await env.LEAGUE_DB.prepare(
      "INSERT INTO cpz_legal_settings(id,responsible_name,contact_email,postal_address,retention_note,legal_basis,approved,revision,updated_at) VALUES(1,?,?,?,?,?,1,1,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET responsible_name=excluded.responsible_name,contact_email=excluded.contact_email,postal_address=excluded.postal_address,retention_note=excluded.retention_note,legal_basis=excluded.legal_basis,approved=1,revision=cpz_legal_settings.revision+1,updated_at=CURRENT_TIMESTAMP"
    ).bind(name,email,address,retention,basis).run();
    const newRow=await env.LEAGUE_DB.prepare('SELECT responsible_name AS responsibleName,contact_email AS contactEmail,postal_address AS postalAddress,retention_note AS retentionNote,legal_basis AS legalBasis,approved,revision,updated_at AS updatedAt FROM cpz_legal_settings WHERE id=1').first();
    return json({ok:true,approved:true,revision:newRow.revision,settings:newRow});
  }catch(error){
    console.error('CPZ legal settings',error?.name||'unknown');
    return json({ok:false,error:'No se pudo guardar la configuración legal.'},500);
  }
}
