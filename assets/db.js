import {
  db, ref, get, set, push, update,
  onValue, query, orderByChild, equalTo, startAt, limitToLast, remove
} from "./firebase.js";
import { randomToken } from "./ui.js";

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

// التعديل هنا: استخدام UID المستخدم كـ ID للطلب لضمان عدم التكرار
export async function createRequest({
  createdByUid,
  createdByType,
  displayName,
  email,
  phone,
  note
}) {
  if (!createdByUid) throw new Error("createRequest: createdByUid is required");
  
  // نستخدم UID المستخدم ليكون هو مسار الطلب الثابت
  const reqRef = ref(db, `requests/${createdByUid}`);
  
  const data = {
    createdByUid,
    createdByType,
    displayName: displayName || "Guest",
    email: email || "",
    phone: phone || "",
    note: note || "",
    status: "pending",
    createdAt: Date.now(),
    lastOfflineAt: 0,
    lastOfflineText: ""
  };

  await set(reqRef, data);
  return { reqId: createdByUid }; 
}

export function listenPendingRequests(cb) {
  const q = query(ref(db, "requests"), orderByChild("status"), equalTo("pending"));
  return onValue(q, (snap) => {
    const out = [];
    snap.forEach((child) => {
      out.push({ reqId: child.key, ...child.val() });
    });
    cb(out);
  });
}

// دالة جديدة لمراقبة أي تحديث في الطلبات (لضمان وصول التنبيهات حتى لو الطلب قديم)
export function listenRequestsWithOffline(cb) {
  const q = query(ref(db, "requests"), orderByChild("lastOfflineAt"), startAt(1));
  return onValue(q, (snap) => {
    const out = [];
    snap.forEach((child) => {
      out.push({ reqId: child.key, ...child.val() });
    });
    cb(out);
  });
}

export async function acceptRequest(reqId) {
  const roomId = "room_" + randomToken(12);
  const roomToken = randomToken(32);
  
  await update(ref(db, `requests/${reqId}`), {
    status: "accepted",
    roomId,
    roomToken,
    acceptedAt: Date.now()
  });

  await set(ref(db, `rooms/${roomId}`), {
    createdAt: Date.now(),
    participants: { [reqId]: true } 
  });
  
  return { roomId, roomToken };
}

export async function rejectRequest(reqId) {
  await update(ref(db, `requests/${reqId}`), { status: "rejected" });
}

export async function sendOfflineMessage({ reqId, fromUid, fromName, text }) {
  const mid = push(ref(db, `offlineMessages/${reqId}`)).key;
  const now = Date.now();
  
  await set(ref(db, `offlineMessages/${reqId}/${mid}`), {
    fromUid,
    fromName,
    text,
    at: now
  });

  await update(ref(db, `requests/${reqId}`), {
    lastOfflineAt: now,
    lastOfflineFrom: fromName,
    lastOfflineText: text.slice(0, 150)
  });
}

export function listenOfflineMessages(reqId, cb) {
  const q = query(ref(db, `offlineMessages/${reqId}`), limitToLast(50));
  return onValue(q, (snap) => {
    const out = [];
    snap.forEach((c) => { out.push({ mid: c.key, ...c.val() }); });
    cb(out);
  });
}

export async function clearOfflineMessagesAsAdmin(reqId) {
  await remove(ref(db, `offlineMessages/${reqId}`));
  await update(ref(db, `requests/${reqId}`), {
    lastOfflineAt: 0,
    lastOfflineFrom: "",
    lastOfflineText: ""
  });
}

export async function sendAdminReply({ reqId, adminUid, text }){
  await update(ref(db, `requests/${reqId}`), {
    adminReplyText: text.slice(0, 800),
    adminReplyAt: Date.now(),
    adminReplyBy: adminUid
  });
}

export async function saveFcmToken(uid, token) {
  if (!uid) return;
  const safe = token.replace(/[^a-zA-Z0-9:_-]/g, "_");
  await set(ref(db, `fcmTokens/${uid}/${safe}`), true);
}

export async function setMyPeerId(roomId, uid, peerId) {
  await set(ref(db, `rooms/${roomId}/peers/${uid}`), peerId);
}