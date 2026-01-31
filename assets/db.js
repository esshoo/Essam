import {
  db, ref, get, set, push, update,
  onValue, query, orderByChild, equalTo
} from "./firebase.js";
import { randomToken } from "./ui.js";

/**
 * Admin allowlists (frontend fallback only)
 * IMPORTANT: This is NOT a security boundary. Real security must be enforced by RTDB Rules + /admins/{uid}=true.
 */
const ADMIN_EMAILS = ["esshoo@gmail.com"];
const ADMIN_UIDS = ["5pJZukLwT8MSfTg73rARyHDnRi62"]; // ✅ UID اللي بعته المستخدم

function normEmail(email) {
  return (email || "").trim().toLowerCase();
}

function isPermissionDenied(err) {
  const msg = (err && err.message) ? err.message : "";
  return /permission denied/i.test(msg);
}

/**
 * Admin check order:
 * 1) UID allowlist (fast + reliable)
 * 2) Email allowlist (Google users only)
 * 3) RTDB admins/{uid} === true (preferred for real security when Rules are set)
 */
export async function isAdmin(uid, email = "") {
  if (!uid) return false;

  // 1) UID allowlist
  if (ADMIN_UIDS.includes(uid)) return true;

  // 2) Email allowlist
  const byEmail = ADMIN_EMAILS.includes(normEmail(email));
  if (byEmail) return true;

  // 3) DB check (best when you configure /admins/{uid}=true + Rules)
  try {
    const snap = await get(ref(db, `admins/${uid}`));
    return snap.exists() && snap.val() === true;
  } catch (err) {
    // If Rules deny reading admins/{uid}, don't crash routing
    if (isPermissionDenied(err)) return false;
    throw err;
  }
}

/**
 * Convenience helper
 */
export async function isAdminUser(user) {
  if (!user) return false;
  return isAdmin(user.uid, user.email || "");
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

  const roomId = reqId;
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

export async function sendOfflineMessage({ reqId, fromUid, fromName, text }) {
  if (!reqId) throw new Error("sendOfflineMessage: reqId is required");

  const mref = push(ref(db, `offlineMessages/${reqId}`));
  await set(mref, {
    fromUid: fromUid || "",
    fromName: fromName || "",
    text: text || "",
    createdAt: Date.now()
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

export async function getRequest(reqId) {
  if (!reqId) throw new Error("getRequest: reqId is required");
  const s = await get(ref(db, `requests/${reqId}`));
  return s.exists() ? s.val() : null;
}

export async function getRoom(roomId) {
  if (!roomId) throw new Error("getRoom: roomId is required");
  const s = await get(ref(db, `rooms/${roomId}`));
  return s.exists() ? s.val() : null;
}
