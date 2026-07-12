// Shared Supabase session handling for index.html, gt.html, mission.html.
// The login form itself (password input + handleLogin) lives only in index.html;
// this file lets every page read, refresh, and use the session that form creates.

// Registered here since every top-level page already loads this file — one
// registration point instead of duplicating the same snippet 5 times. The
// path 'sw.js' resolves relative to the CALLING page's URL (all 5 pages
// live at the repo root), not this file's own /public/ location, so it
// correctly registers /sw.js with root scope regardless of which page
// loaded it. See sw.js itself for what it does and (deliberately) doesn't
// cache.
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(e=>console.warn('SW registration failed',e));
  });
}

const SB_URL="https://bezcgrtihvmktxjkbfrl.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlemNncnRpaHZta3R4amtiZnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNzQ2OTQsImV4cCI6MjA5Njg1MDY5NH0.7BhpVFAsjW0fDDvk1r9RMITYtzoosLHqsX80AAQSqA8";

const authGet=(k,d)=>{try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):d}catch{return d}};
const authSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

let authSession=authGet('sb_session',null);

const buildHeaders=(opts={})=>({
  'apikey':SB_KEY,
  'Authorization':`Bearer ${authSession?.access_token||SB_KEY}`,
  'Content-Type':opts.contentType||'application/json',
  ...opts.extra
});

const setAuthSession=ses=>{
  authSession=ses;
  authSet('sb_session',ses||null);
};

const refreshSession=async()=>{
  if(!authSession?.refresh_token) return false;
  try{
    const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:authSession.refresh_token});
    const resp=await fetch(`${SB_URL}/auth/v1/token`,{method:'POST',headers:{'apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
    const data=await resp.json().catch(()=>null);
    if(!resp.ok){
      throw new Error(data?.error_description||data?.error||`Refresh failed (${resp.status})`);
    }
    setAuthSession({
      access_token:data.access_token,
      refresh_token:data.refresh_token||authSession.refresh_token,
      expires_at:Date.now()+data.expires_in*1000,
      user:data.user,
    });
    return true;
  }catch(e){
    console.warn('Auth refresh failed',e);
    setAuthSession(null);
    return false;
  }
};

// Resolves true if a valid (or refreshed) session is available. Pure session check -
// callers own any UI reaction (login screen, "log in elsewhere first" notice, etc).
const initAuth=async()=>{
  if(!authSession) return false;
  if(authSession.expires_at && Date.now()>authSession.expires_at-60000){
    const refreshed=await refreshSession();
    if(!refreshed) return false;
  }
  return true;
};
