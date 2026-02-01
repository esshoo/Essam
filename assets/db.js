export function listenAllRequests(cb){
  return onValue(ref(db, "requests"), (snap)=>{
    const out = [];
    snap.forEach((ch)=> out.push({ id: ch.key, ...ch.val() }));
    out.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
    cb(out);
  });
}

export function listenOfflineThreadsAdmin(cb){
  // Admin-only listing of /offlineMessages to avoid relying on lastOfflineAt updates.
  return onValue(ref(db, "offlineMessages"), (snap)=>{
    const threads = [];
    snap.forEach((threadSnap)=>{
      let last = null;
      threadSnap.forEach((m)=>{
        const v = m.val();
        if(!last || (v?.createdAt||0) > (last.createdAt||0)){
          last = { id: m.key, ...(v||{}) };
        }
      });
      threads.push({ reqId: threadSnap.key, last });
    });
    threads.sort((a,b)=> ((b.last?.createdAt)||0) - ((a.last?.createdAt)||0));
    cb(threads);
  });
}

export async function deleteOfflineMessageAsAdmin(reqId, msgId){
  if(!reqId) throw new Error("deleteOfflineMessageAsAdmin: reqId is required");
  if(!msgId) throw new Error("deleteOfflineMessageAsAdmin: msgId is required");
  await remove(ref(db, `offlineMessages/${reqId}/${msgId}`));
}

import {
  db, ref, get, set, push, update,
  onValue, query, orderByChild, equalTo, startAt, limitToLast, remove
} from "./firebase.js";
import { randomToken } from "./ui.js";

/**
 * Admin allowlist by email (frontend fallback only)
 * Real security is enforced by RTDB Rules.
 */
const ADMIN_EMAILS = ["esshoo@gmail.com"];
function normEmail(email){ return (email||"").trim().toLowerCase(); }
function isPermissionDenied(err){
  const msg = (err && err.message) ? err.message : "";
  return /permission denied/i.test(msg);
}

export async function isAdmin(uid, email = "") {
  if (!uid) return false;
  try {
    const snap = await get(ref(db, `admins/${uid}`));
    const byUid = snap.exists() && snap.val() === true;
    const byEmail = ADMIN_EMAILS.includes(normEmail(email));
    return byUid || byEmail;
  } catch (err) {
    if (isPermissionDenied(err)) {
      return ADMIN_EMAILS.includes(normEmail(email));
    }
    throw err;
  }
}

export async function createRequest({
  createdByUid,
  createdByType,
  displayName,
  email,
  phone,
  note
}) {
  if (!createdByUid) throw new Error("createRequest: createdByUid is required");
  if (!createdByType) throw new Error("createRequest: createdByType is required");

  const reqRef = push(ref(db, "requests"));
  const payload = {
    createdByUid,
    createdByType,
    displayName: displayName || (email || "") || "",   // ✅ أفضل من فاضي
    email: email || "",
    phone: phone || "",
    note: note || "",
    status: "pending",
    assignedAdminUid: "",
    roomId: "",
    roomToken: "",
    createdAt: Date.now(),

    // ✅ مؤشرات للأوفلاين (عشان الأدمن يشوفها بسهولة)
    lastOfflineAt: 0,
    lastOfflineFrom: "",
    lastOfflineText: ""
  };

  await set(reqRef, payload);
  return { reqId: reqRef.key };
}

export function listenMyRequest(reqId, cb) {
  if (!reqId) throw new Error("listenMyRequest: reqId is required");
  return onValue(ref(db, `requests/${reqId}`), (snap) => cb(snap.exists() ? snap.val() : null));
}

export function listenPendingRequests(cb) {
  const q = query(ref(db, "requests"), orderByChild("status"), equalTo("pending"));
  return onValue(q, (snap) => {
    const out = [];
    snap.forEach((ch) => out.push({ id: ch.key, ...ch.val() }));
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(out);
  });
}

export async function acceptRequest({ reqId, adminUid }) {
  if (!reqId) throw new Error("acceptRequest: reqId is required");
  if (!adminUid) throw new Error("acceptRequest: adminUid is required");

  const roomId = reqId;              // keep mapping simple
  const token = randomToken(36);

  const reqSnap = await get(ref(db, `requests/${reqId}`));
  if (!reqSnap.exists()) throw new Error(`acceptRequest: request not found (${reqId})`);
  const r = reqSnap.val();

  const updates = {};
  updates[`requests/${reqId}/status`] = "accepted";
  updates[`requests/${reqId}/acceptedAt`] = Date.now();
  updates[`requests/${reqId}/assignedAdminUid`] = adminUid;
  updates[`requests/${reqId}/roomId`] = roomId;
  updates[`requests/${reqId}/roomToken`] = token;

  updates[`rooms/${roomId}/requestId`] = reqId;
  updates[`rooms/${roomId}/active`] = true;
  updates[`rooms/${roomId}/createdAt`] = Date.now();
  updates[`rooms/${roomId}/participants/${adminUid}`] = true;

  if (r && r.createdByUid) {
    updates[`rooms/${roomId}/participants/${r.createdByUid}`] = true;
  }

  await update(ref(db), updates);
  return { roomId, token };
}

export async function rejectRequest({ reqId, adminUid }) {
  if (!reqId) throw new Error("rejectRequest: reqId is required");
  await update(ref(db, `requests/${reqId}`), {
    status: "rejected",
    rejectedAt: Date.now(),
    assignedAdminUid: adminUid || ""
  });
}

/**
 * Close a request/session (admin only).
 * Clears room token so the room can't be reopened without a new request.
 */
export async function closeRequestAsAdmin({ reqId, adminUid, reason = "ended" }) {
  if (!reqId) throw new Error("closeRequestAsAdmin: reqId is required");
  if (!adminUid) throw new Error("closeRequestAsAdmin: adminUid is required");

  const endedAt = Date.now();
  const updates = {};
  updates[`requests/${reqId}/status`] = "closed";
  updates[`requests/${reqId}/endedAt`] = endedAt;
  updates[`requests/${reqId}/endedBy`] = adminUid;
  updates[`requests/${reqId}/endReason`] = reason;
  updates[`requests/${reqId}/roomId`] = "";
  updates[`requests/${reqId}/roomToken`] = "";

  updates[`rooms/${reqId}/active`] = false;
  updates[`rooms/${reqId}/endedAt`] = endedAt;
  updates[`rooms/${reqId}/endedBy`] = adminUid;
  updates[`rooms/${reqId}/endReason`] = reason;

  await update(ref(db), updates);
}

export function listenRequest(reqId, cb) {
  if (!reqId) throw new Error("listenRequest: reqId is required");
  return onValue(ref(db, `requests/${reqId}`), (snap) => cb(snap.exists() ? snap.val() : null));
}

export async function sendOfflineMessage({ reqId, fromUid, fromName, text }) {
  if (!reqId) throw new Error("sendOfflineMessage: reqId is required");

  const mref = push(ref(db, `offlineMessages/${reqId}`));
  const payload = {
    fromUid: fromUid || "",
    fromName: fromName || "",
    text: text || "",
    createdAt: Date.now()
  };

  // 1) Save the offline message
  await set(mref, payload);

  // 2) Update a small summary on the request (so Admin sees it quickly)
  // IMPORTANT: do a multi-location update so Rules can be applied per-field.
  await update(ref(db), {
    [`requests/${reqId}/lastOfflineAt`]: payload.createdAt,
    [`requests/${reqId}/lastOfflineFrom`]: payload.fromName || payload.fromUid || "",
    [`requests/${reqId}/lastOfflineText`]: (payload.text || "").slice(0, 120)
  });
}


export function listenOfflineMessagesForRequest(reqId, cb) {
  if (!reqId) throw new Error("listenOfflineMessagesForRequest: reqId is required");
  return onValue(ref(db, `offlineMessages/${reqId}`), (snap) => {
    const out = [];
    snap.forEach((ch) => out.push({ id: ch.key, ...ch.val() }));
    out.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    cb(out);
  });
}



export function listenRequestsWithOffline(cb){
  // Requests that have lastOfflineAt > 0 (admin only, enforced by rules)
  const q = query(ref(db, "requests"), orderByChild("lastOfflineAt"), startAt(1), limitToLast(50));
  return onValue(q, (snap) => {
    const out = [];
    snap.forEach((ch) => out.push({ id: ch.key, ...ch.val() }));
    out.sort((a,b)=> (b.lastOfflineAt||0) - (a.lastOfflineAt||0));
    cb(out);
  });
}

export async function clearOfflineMessagesAsAdmin(reqId){
  if(!reqId) throw new Error("clearOfflineMessagesAsAdmin: reqId is required");
  // Delete the whole thread (admin only, enforced by rules)
  await remove(ref(db, `offlineMessages/${reqId}`));
  // Clear summary fields so it disappears from the admin inbox
  await update(ref(db), {
    [`requests/${reqId}/lastOfflineAt`]: 0,
    [`requests/${reqId}/lastOfflineFrom`]: "",
    [`requests/${reqId}/lastOfflineText`]: "",
    [`requests/${reqId}/adminReplyAt`]: 0,
    [`requests/${reqId}/adminReplyText`]: "",
    [`requests/${reqId}/adminReplyBy`]: ""
  });
}

export async function sendAdminReply({ reqId, adminUid, text }){
  if(!reqId) throw new Error("sendAdminReply: reqId is required");
  if(!adminUid) throw new Error("sendAdminReply: adminUid is required");
  const t = (text||"").trim();
  if(!t) throw new Error("sendAdminReply: empty");

  // 1) Store as an offline message so the client/guest can see it in the same thread.
  const mref = push(ref(db, `offlineMessages/${reqId}`));
  const payload = {
    fromUid: adminUid,
    fromName: "الدعم",
    text: t.slice(0, 1200),
    createdAt: Date.now()
  };
  await set(mref, payload);

  // 2) Also set a small reply snapshot on the request to trigger client-side toasts.
  await update(ref(db), {
    [`requests/${reqId}/adminReplyText`]: payload.text.slice(0, 800),
    [`requests/${reqId}/adminReplyAt`]: payload.createdAt,
    [`requests/${reqId}/adminReplyBy`]: adminUid,

    // keep lastOffline* updated so it appears in admin inbox too
    [`requests/${reqId}/lastOfflineAt`]: payload.createdAt,
    [`requests/${reqId}/lastOfflineFrom`]: payload.fromName,
    [`requests/${reqId}/lastOfflineText`]: payload.text.slice(0, 120)
  });
}


export async function saveFcmToken(uid, token) {
  if (!uid) throw new Error("saveFcmToken: uid is required");
  if (!token) return;
  const safe = token.replace(/[^a-zA-Z0-9:_-]/g, "_");
  await set(ref(db, `fcmTokens/${uid}/${safe}`), true);
}

export async function setMyPeerId(roomId, uid, peerId) {
  if (!roomId) throw new Error("setMyPeerId: roomId is required");
  if (!uid) throw new Error("setMyPeerId: uid is required");
  if (!peerId) throw new Error("setMyPeerId: peerId is required");
  await set(ref(db, `rooms/${roomId}/peerIds/${uid}`), peerId);
}

export function listenPeerIds(roomId, cb) {
  if (!roomId) throw new Error("listenPeerIds: roomId is required");
  return onValue(ref(db, `rooms/${roomId}/peerIds`), (snap) => cb(snap.exists() ? snap.val() : {}));
}
