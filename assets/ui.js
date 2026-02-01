export const qs = (sel, root=document) => root.querySelector(sel);

export function toast(title, body="", ms=5200){
  let wrap = document.querySelector(".toast-wrap");
  if(!wrap){
    wrap = document.createElement("div");
    wrap.className="toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className="toast";
  el.innerHTML = `<div class="t"></div><div class="b"></div>`;
  el.querySelector(".t").textContent = title;
  el.querySelector(".b").textContent = body;
  wrap.appendChild(el);
  setTimeout(()=>{ el.remove(); }, ms);
}

export function sanitizeId(s){
  return String(s||"").replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,80);
}

export function randomToken(len=28){
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out="";
  crypto.getRandomValues(new Uint8Array(len)).forEach(n=> out += chars[n%chars.length]);
  return out;
}


export function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

export function fmtTime(ms){
  const t = Number(ms||0);
  if(!t) return "—";
  try{
    return new Date(t).toLocaleString("ar-EG", { hour12:true });
  }catch{
    return String(t);
  }
}
