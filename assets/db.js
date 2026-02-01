import {
  db, ref, get, set, push, update,
  onValue, query, orderByChild, equalTo
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

/**
 * Global offline messages feed (similar to the old project).
 * Admin reads this to see messages immediately without typing reqId.
 */
export async function pushGlobalMessage({ reqId, fromUid, name, contact, type, content }) {
  const mref = push(ref(db, `messages`));
  await set(mref, {
    reqId: reqId || "",
    fromUid: fromUid || "",
    name: name || "",
    contact: contact || "",
    type: type || "",
    content: content || "",
    timestamp: Date.now()
  });
}

export function listenGlobalMessages(cb) {
  // latest first (simple)
  return onValue(ref(db, `messages`), (snap) => {
    const out = [];
    snap.forEach((ch) => out.push({ id: ch.key, ...ch.val() }));
    out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    cb(out);
  });
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

  await set(mref, payload);

  // ✅ تحديث request عشان الأدمن يشوف إن فيه رسالة أوفلاين بدون ما يدور
  await update(ref(db, `requests/${reqId}`), {
    lastOfflineAt: payload.createdAt,
    lastOfflineFrom: payload.fromName || payload.fromUid || "",
    lastOfflineText: (payload.text || "").slice(0, 120)
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
