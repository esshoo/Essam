import { db, ref, get, set, push, update, onValue, query, orderByChild, equalTo } from "./firebase.js";
import { randomToken } from "./ui.js";

export async function isAdmin(uid){
  if(!uid) return false;
  const snap = await get(ref(db, `admins/${uid}`));
  return snap.exists() && snap.val() === true;
}

export async function createRequest({ createdByUid, createdByType, displayName, email, phone, note }){
  const reqRef = push(ref(db, "requests"));
  const payload = {
    createdByUid,
    createdByType,
    displayName: displayName || "",
    email: email || "",
    phone: phone || "",
    note: note || "",
    status: "pending",
    assignedAdminUid: "",
    roomId: "",
    roomToken: "",
    createdAt: Date.now()
  };
  await set(reqRef, payload);
  return { reqId: reqRef.key };
}

export function listenMyRequest(reqId, cb){
  return onValue(ref(db, `requests/${reqId}`), (snap)=> cb(snap.exists()? snap.val(): null));
}

export function listenPendingRequests(cb){
  const q = query(ref(db, "requests"), orderByChild("status"), equalTo("pending"));
  return onValue(q, (snap)=>{
    const out = [];
    snap.forEach(ch => out.push({ id: ch.key, ...ch.val() }));
    out.sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
    cb(out);
  });
}

export async function acceptRequest({ reqId, adminUid }){
  const roomId = reqId;
  const token = randomToken(36);
  const updates = {};
  updates[`requests/${reqId}/status`] = "accepted";
  updates[`requests/${reqId}/assignedAdminUid`] = adminUid;
  updates[`requests/${reqId}/roomId`] = roomId;
  updates[`requests/${reqId}/roomToken`] = token;

  updates[`rooms/${roomId}/requestId`] = reqId;
  updates[`rooms/${roomId}/active`] = true;
  updates[`rooms/${roomId}/createdAt`] = Date.now();
  updates[`rooms/${roomId}/participants/${adminUid}`] = true;

  const reqSnap = await get(ref(db, `requests/${reqId}`));
  if(reqSnap.exists()){
    const r = reqSnap.val();
    if(r.createdByUid) updates[`rooms/${roomId}/participants/${r.createdByUid}`] = true;
  }

  await update(ref(db), updates);
  return { roomId, token };
}

export async function rejectRequest({ reqId, adminUid }){
  await update(ref(db, `requests/${reqId}`), { status: "rejected", assignedAdminUid: adminUid || "" });
}

export async function sendOfflineMessage({ reqId, fromUid, fromName, text }){
  const mref = push(ref(db, `offlineMessages/${reqId}`));
  await set(mref, {
    fromUid: fromUid || "",
    fromName: fromName || "",
    text: text || "",
    createdAt: Date.now()
  });
}

export function listenOfflineMessagesForRequest(reqId, cb){
  return onValue(ref(db, `offlineMessages/${reqId}`), (snap)=>{
    const out=[];
    snap.forEach(ch=> out.push({ id: ch.key, ...ch.val() }));
    out.sort((a,b)=> (a.createdAt||0)-(b.createdAt||0));
    cb(out);
  });
}

export async function saveFcmToken(uid, token){
  const safe = token.replace(/[^a-zA-Z0-9:_-]/g,"_");
  await set(ref(db, `fcmTokens/${uid}/${safe}`), true);
}

export async function setMyPeerId(roomId, uid, peerId){
  await set(ref(db, `rooms/${roomId}/peerIds/${uid}`), peerId);
}
export function listenPeerIds(roomId, cb){
  return onValue(ref(db, `rooms/${roomId}/peerIds`), (snap)=> cb(snap.exists()? snap.val(): {}));
}

export async function getRequest(reqId){
  const s = await get(ref(db, `requests/${reqId}`));
  return s.exists()? s.val(): null;
}
export async function getRoom(roomId){
  const s = await get(ref(db, `rooms/${roomId}`));
  return s.exists()? s.val(): null;
}
