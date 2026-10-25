// LeagueOS CPZ — Cloudflare Pages middleware global.
// Protege HTML, recursos estáticos y APIs con una cookie de sesión validada en el servidor.
// Solamente /api/login, /api/logout y /api/session son endpoints accesibles sin sesión.
const SESSION = '__Host-leagueos_admin';
const SESSION_AGE = 8 * 60 * 60;
const LOGIN_HTML = "<!doctype html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#082c2b\">\n<meta name=\"robots\" content=\"noindex,nofollow,noarchive\">\n<title>Acceso privado · Ranking CPZ 2026/27</title>\n<style>\n:root{font-family:Inter,-apple-system,BlinkMacSystemFont,\"Segoe UI\",Arial,sans-serif;color:#1e3135;background:#f1f6f3;--primary:#116b4d;--ink:#142f34}\n*{box-sizing:border-box}\nhtml,body{min-height:100%;margin:0}body{min-height:100vh}button,input{font:inherit}button{cursor:pointer}\n.shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.04fr) minmax(410px,.96fr)}\n.story{position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:44px clamp(28px,5vw,78px);color:white;background:radial-gradient(ellipse at 92% 13%,#1c7b61 0,transparent 48%),linear-gradient(145deg,#0b3838 0%,#071e2b 100%)}\n.story:before{content:\"\";position:absolute;width:560px;height:560px;border-radius:50%;right:-270px;bottom:-230px;border:1px solid #ffffff2b;box-shadow:0 0 0 75px #ffffff06,0 0 0 150px #ffffff04;z-index:-1}\n.club-brand{display:flex;align-items:center;gap:15px}.club-brand img{width:76px;height:80px;object-fit:contain;filter:drop-shadow(0 8px 22px #0004)}.club-brand strong{font-size:17px;display:block;letter-spacing:.2px}.club-brand small{font-size:11px;letter-spacing:1.8px;text-transform:uppercase;display:block;color:#b5d8cb;margin-top:6px}\n.story-body{max-width:620px;padding:55px 0}.eyebrow{display:inline-flex;align-items:center;gap:9px;color:#c4ecc9;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase}.eyebrow:before{content:\"\";width:7px;height:7px;border-radius:50%;background:#b9ed9a;box-shadow:0 0 0 4px #b9ed9a22}\n.story h1{font-size:clamp(39px,4.8vw,73px);line-height:1.035;letter-spacing:-2.4px;margin:24px 0 24px;font-weight:800}.story h1 em{font-style:normal;color:#b6eaac}\n.story-body>p{max-width:470px;color:#c0dcd4;line-height:1.85;font-size:15px;margin:0}\n.court-scene{position:relative;max-width:445px;margin-top:53px;padding:18px;transform:rotate(-5deg);opacity:.9}\n.court-scene:before{content:\"\";position:absolute;inset:0;background:linear-gradient(145deg,#1b7774,#187965);border:5px solid #dcf2e3;box-shadow:0 28px 42px #001a2080;border-radius:7px}\n.court-scene svg{position:relative;display:block;width:100%;height:auto}\n.story-foot{display:flex;justify-content:space-between;gap:15px;align-items:center;color:#a8c8c5;font-size:12px;border-top:1px solid #ffffff20;padding-top:19px;flex-wrap:wrap}.story-foot b{font-weight:650;color:#d9f4e5}\n.login-side{min-height:100vh;padding:48px clamp(26px,5.5vw,90px);display:flex;justify-content:center;flex-direction:column;align-items:center;background:radial-gradient(circle at 10% 4%,#e2f3e8,transparent 33%),#f5f8f6}\n.login-card{width:100%;max-width:448px}.compact-brand{display:none;align-items:center;gap:11px;margin-bottom:30px}.compact-brand img{width:55px;height:57px;object-fit:contain}.compact-brand strong{font-weight:850;color:#103a33;letter-spacing:-.4px;font-size:19px}.compact-brand small{display:block;color:#748a81;font-size:11px;margin-top:3px}\n.security-label{display:inline-flex;align-items:center;gap:8px;font-size:10px;font-weight:850;letter-spacing:1.35px;text-transform:uppercase;color:#15674a;background:#ddefe3;border:1px solid #c9e6d4;border-radius:30px;padding:9px 12px}\n.security-label svg{width:13px;height:13px}\n.login-card h2{font-size:clamp(31px,3vw,40px);letter-spacing:-1.2px;line-height:1.13;margin:24px 0 13px;color:#183b39}\n.login-card .description{font-size:14px;color:#6d827b;line-height:1.8;max-width:390px;margin:0 0 33px}\n.form-field{display:flex;flex-direction:column;gap:10px}\n.form-field label{font-weight:750;font-size:13px;color:#27463c}\n.password-wrap{display:flex;align-items:center;background:white;border:1.5px solid #dbe6df;border-radius:12px;transition:border-color .15s,box-shadow .15s;box-shadow:0 4px 20px #13372506}\n.password-wrap:focus-within{border-color:#42a076;box-shadow:0 0 0 4px #3aa6761b}\n.password-wrap input{border:0;outline:0;background:transparent;padding:16px 17px;width:100%;min-width:0;font-size:16px;color:#1a3931}\n.password-wrap input::placeholder{color:#a5b7ae}\n#togglePassword{border:0;background:transparent;display:flex;align-items:center;justify-content:center;color:#6e877c;padding:13px 15px}\n#togglePassword:focus-visible,.login-submit:focus-visible{outline:3px solid #69b98b;outline-offset:3px}\n.login-submit{width:100%;background:#125f47;color:white;border:0;border-radius:12px;padding:17px 18px;display:flex;align-items:center;justify-content:space-between;margin-top:16px;font-size:14px;font-weight:800;box-shadow:0 12px 28px #135d4626;transition:transform .15s,background .15s}\n.login-submit:hover{background:#0c4d39;transform:translateY(-1px)}\n.login-submit:disabled{cursor:progress;opacity:.72;transform:none}\n.login-submit .arrow{font-size:21px;font-weight:450;line-height:1}\n#loginMessage{min-height:22px;font-size:12px;margin-top:12px;color:#b33434;font-weight:650;line-height:1.6}\n.small-note{border-top:1px solid #dde6df;margin-top:32px;padding-top:21px;display:flex;gap:13px;color:#72897c;font-size:12px;line-height:1.75}\n.small-note .lock{flex-shrink:0;display:flex;width:32px;height:32px;align-items:center;justify-content:center;background:#e7f1e9;border-radius:10px;color:#267552}\n.login-foot{margin-top:70px;color:#93a69b;font-size:11px;text-align:center;line-height:1.75;max-width:420px}\n.login-foot a{color:#577b68;text-decoration:underline;text-underline-offset:2px}\n@media(max-width:920px){.shell{grid-template-columns:1fr}.story{min-height:190px;padding:23px 26px 25px}.story-body,.story-foot{display:none}.club-brand img{height:62px;width:62px}.club-brand strong{font-size:16px}.login-side{min-height:calc(100vh - 190px);padding:33px 25px}.login-card{max-width:480px}.compact-brand{display:none}.login-foot{margin-top:48px}}\n@media(max-width:520px){.story{min-height:130px;padding:18px 22px}.club-brand img{width:56px;height:57px}.club-brand strong{font-size:14px}.club-brand small{font-size:9px}.login-side{min-height:calc(100vh - 130px);padding:27px 23px 35px}.login-card h2{font-size:33px}.login-card .description{margin-bottom:25px}.login-foot{margin-top:36px}}\n@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}\n</style>\n</head>\n<body>\n<div class=\"shell\">\n  <section class=\"story\" aria-label=\"Ranking Individual Club Pickleball Zaragoza\">\n    <div class=\"club-brand\">\n      <img src=\"https://clubpickleballzaragoza.com/wp-content/uploads/2025/11/cropped-LOGO_CLUB_PICKLEBALL_ZARAGOZA_page-0001-removebg-preview-300x279.webp\" alt=\"Escudo de Club Pickleball Zaragoza\" width=\"76\" height=\"80\">\n      <div><strong>Club Pickleball Zaragoza</strong><small>Ranking individual 2026/27</small></div>\n    </div>\n    <div class=\"story-body\">\n      <div class=\"eyebrow\">Temporada 2026 — 2027</div>\n      <h1>La liga, <em>en tus manos.</em></h1>\n      <p>Un espacio para organizar enfrentamientos, seguir la clasificación y vivir cada jornada del Ranking CPZ.</p>\n      <div class=\"court-scene\" aria-hidden=\"true\">\n        <svg viewBox=\"0 0 440 188\" role=\"img\">\n          <path d=\"M7 5H433V183H7Z\" fill=\"none\" stroke=\"#e6f4e6\" stroke-width=\"4\"/>\n          <path d=\"M220 5V183M7 94H433M132 5V94M308 5V94\" fill=\"none\" stroke=\"#e6f4e6\" stroke-width=\"3\"/>\n          <circle cx=\"220\" cy=\"94\" r=\"4\" fill=\"#e6f4e6\"/>\n        </svg>\n      </div>\n    </div>\n    <div class=\"story-foot\"><span>League<span style=\"color:#b2edb7;font-weight:800\">OS</span> <span style=\"opacity:.56\">/</span> CPZ</span><b>Compite · Mejora · Asciende</b></div>\n  </section>\n  <main class=\"login-side\">\n    <div class=\"login-card\">\n      <div class=\"security-label\"><svg fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"5\" y=\"10\" width=\"14\" height=\"11\" rx=\"2\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3\"/></svg> Acceso restringido</div>\n      <h2>Bienvenido a<br>LeagueOS CPZ.</h2>\n      <p class=\"description\">Por ahora, solo los administradores autorizados pueden acceder al ranking. Próximamente habilitaremos las cuentas para jugadores.</p>\n      <form id=\"privateLogin\">\n        <div class=\"form-field\">\n          <label for=\"loginPassword\">Contraseña de administrador</label>\n          <div class=\"password-wrap\">\n            <input id=\"loginPassword\" type=\"password\" name=\"password\" required minlength=\"12\" maxlength=\"256\" placeholder=\"Introduce tu contraseña\" autocomplete=\"current-password\" autofocus>\n            <button id=\"togglePassword\" type=\"button\" aria-label=\"Mostrar contraseña\" aria-pressed=\"false\">\n              <svg width=\"21\" height=\"21\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>\n            </button>\n          </div>\n        </div>\n        <button class=\"login-submit\" id=\"loginSubmit\" type=\"submit\"><span>Entrar al panel de administración</span><span class=\"arrow\" aria-hidden=\"true\">→</span></button>\n        <div id=\"loginMessage\" role=\"status\" aria-live=\"polite\"></div>\n      </form>\n      <div class=\"small-note\"><span class=\"lock\" aria-hidden=\"true\">◆</span><span>Esta plataforma se encuentra en fase privada. La contraseña se verifica de forma segura y no se publica en esta página.</span></div>\n    </div>\n    <div class=\"login-foot\">Ranking Individual CPZ · Temporada 2026/27<br>Plataforma de gestión LeagueOS · <a href=\"https://clubpickleballzaragoza.com/\" target=\"_blank\" rel=\"noopener noreferrer\">Web del club</a></div>\n  </main>\n</div>\n<script nonce=\"__LOGIN_NONCE__\">\n(function(){\n  'use strict';\n  var form=document.getElementById('privateLogin');\n  var input=document.getElementById('loginPassword');\n  var message=document.getElementById('loginMessage');\n  var button=document.getElementById('loginSubmit');\n  var toggle=document.getElementById('togglePassword');\n  toggle.addEventListener('click',function(){\n    var visible=input.type==='password';\n    input.type=visible?'text':'password';\n    toggle.setAttribute('aria-pressed',String(visible));\n    toggle.setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');\n  });\n  form.addEventListener('submit',async function(e){\n    e.preventDefault();\n    if(button.disabled)return;\n    button.disabled=true;\n    button.querySelector('span').textContent='Verificando acceso…';\n    message.textContent='';\n    try{\n      var res=await fetch('/api/login',{\n        method:'POST',\n        headers:{'Content-Type':'application/json'},\n        credentials:'same-origin',\n        cache:'no-store',\n        body:JSON.stringify({password:input.value})\n      });\n      var data={};\n      try{data=await res.json()}catch(ignore){}\n      input.value='';\n      if(!res.ok)throw new Error(data.error||'No se ha podido iniciar sesión.');\n      window.location.reload();\n    }catch(err){\n      message.textContent=err&&err.message?err.message:'Error de conexión. Inténtalo de nuevo.';\n      button.disabled=false;\n      button.querySelector('span').textContent='Entrar al panel de administración';\n      input.focus();\n    }\n  });\n})();\n</script>\n</body>\n</html>";
const te = new TextEncoder();

async function authenticated(request, secret) {
  if(typeof secret !== 'string' || secret.length < 12) return false;
  const cookie = (request.headers.get('Cookie') || '')
    .split(';').map(v => v.trim()).find(v => v.startsWith(SESSION + '='));
  if(!cookie) return false;
  const parts = cookie.slice(SESSION.length + 1).split('.');
  if(parts.length !== 4 || parts[0] !== '1' || !/^[0-9]{13}$/.test(parts[1])) return false;
  const expiry = Number(parts[1]);
  const now = Date.now();
  if(expiry < now || expiry > now + SESSION_AGE * 1000) return false;
  try {
    const raw = parts[3].replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', te.encode(secret),
      {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, bytes,
      te.encode(parts.slice(0,3).join('.')));
  } catch(e) {
    return false;
  }
}

function privateLogin(request) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
  const html = LOGIN_HTML.replace('__LOGIN_NONCE__', nonce);
  const headers = new Headers({
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'private, no-store, max-age=0',
    'Pragma':'no-cache',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'none'; script-src 'nonce-" + nonce
      + "'; style-src 'unsafe-inline'; img-src 'self' https://clubpickleballzaragoza.com;"
      + " connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
  return new Response(request.method === 'HEAD' ? null : html, {status:200, headers});
}

function denyAPI(){
  return new Response(JSON.stringify({ok:false,error:'Acceso privado. Inicia sesión como administrador.'}),{
    status:401,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff'
    }
  });
}

export async function onRequest(context){
  const {request,env} = context;
  const path = new URL(request.url).pathname;

  // Solo los endpoints de autenticación son públicos.
  if(path === '/api/login' || path === '/api/logout' || path === '/api/session'){
    return context.next();
  }

  const signedIn = await authenticated(request,env.ADMIN_PASSWORD);
  if(!signedIn){
    if(path.startsWith('/api/'))return denyAPI();
    if((path === '/' || path === '/index.html') && (request.method === 'GET' || request.method === 'HEAD')){
      return privateLogin(request);
    }
    if(request.method !== 'GET' && request.method !== 'HEAD'){
      return new Response('Método no permitido.',{status:405,headers:{'Cache-Control':'no-store'}});
    }
    const redirect = new Response(null,{status:302,headers:{
      'Location':'/',
      'Cache-Control':'private, no-store, max-age=0',
      'Referrer-Policy':'no-referrer'
    }});
    return redirect;
  }

  const response = await context.next();
  // Evitar caché compartida del HTML autenticado, incluidos fragmentos estáticos.
  const headers = new Headers(response.headers);
  headers.set('Cache-Control','private, no-store, max-age=0');
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','same-origin');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
