import {
  db, ref, get, set, push, update,
  onValue, query, orderByChild, equalTo, startAt, limitToLast, remove
} from "./firebase.js";
import { randomToken } from "./ui.js";

const ADMIN_EMAILS = ["esshoo@gmail.com"];

export async function isAdmin(uid, email = "") {
  if (!uid) return false;
  const snap = await get(ref(db, `admins/${uid}`));
  return (snap.exists() && snap.val() === true) || ADMIN_EMAILS.includes(email.toLowerCase());
}

// إنشاء أو تحديث طلب باستخدام UID ثابت لمنع التكرار
export async function createRequest({ createdByUid, createdByType, displayName, email, phone, note }) {
  const reqRef = ref(db, `requests/${createdByUid}`);
  const payload = {
    createdByUid,
    createdByType,
    displayName: displayName || "عميل",
    email: email || "",
    phone: phone || "",
    note: note || "",
    status: "pending",
    createdAt: Date.now(),
    lastOfflineAt: 0
  };
  await set(reqRef, payload);
  return { reqId: createdByUid };
}

// دالة مراقبة حالة الطلب (المستخدمة في client و guest)
export function listenRequest(reqId, cb) {
  if (!reqId) return;
  return onValue(ref(db, `requests/${reqId}`), (snap) => cb(snap.exists() ? snap.val() : null));
}

// دالة جلب الطلبات المعلقة للمدير
export function listenPendingRequests(cb) {
  const q = query(ref(db, "requests"), orderByChild("status"), equalTo("pending"));
  return onValue(q, (snap) => {
    const out = [];
    snap.forEach((ch) => out.push({ reqId: ch.key, ...ch.val() }));
    cb(out);
  });
}

// قبول الطلب وتوليد غرفة
export async function acceptRequest(reqId) {
  const roomId = reqId; 
  const roomToken = randomToken(32);
  await update(ref(db, `requests/${reqId}`), {
    status: "accepted",
    roomId,
    roomToken,
    acceptedAt: Date.now()
  });
  return { roomId, roomToken };
}

export async function rejectRequest(reqId) {
  await update(ref(db, `requests/${reqId}`), { status: "rejected" });
}

// إرسال رسائل أوفلاين وتحديث "آخر رسالة" للتنبيه
export async function sendOfflineMessage({ reqId, fromUid, fromName, text }) {
  const mid = push(ref(db, `offlineMessages/${reqId}`)).key;
  const now = Date.now();
  await set(ref(db, `offlineMessages/${reqId}/${mid}`), { fromUid, fromName, text, createdAt: now });
  await update(ref(db, `requests/${reqId}`), {
    lastOfflineAt: now,
    lastOfflineFrom: fromName,
    lastOfflineText: text.slice(0, 120)
  });
}

export function listenOfflineMessages(reqId, cb) {
  return onValue(ref(db, `offlineMessages/${reqId}`), (snap) => {
    const out = [];
    snap.forEach((ch) => out.push({ id: ch.key, ...ch.val() }));
    cb(out);
  });
}

export function listenRequestsWithOffline(cb) {
  const q = query(ref(db, "requests"), orderByChild("lastOfflineAt"), startAt(1));
  return onValue(q, (snap) => {
    const out = [];
    snap.forEach((ch) => out.push({ reqId: ch.key, ...ch.val() }));
    cb(out);
  });
}

export async function clearOfflineMessagesAsAdmin(reqId) {
  await remove(ref(db, `offlineMessages/${reqId}`));
  await update(ref(db, `requests/${reqId}`), { lastOfflineAt: 0, lastOfflineText: "" });
}

export async function sendAdminReply({ reqId, adminUid, text }){
  await update(ref(db, `requests/${reqId}`), {
    adminReplyText: text,
    adminReplyAt: Date.now(),
    adminReplyBy: adminUid
  });
}

export async function saveFcmToken(uid, token) {
  if (!uid || !token) return;
  const safe = token.replace(/[^a-zA-Z0-9:_-]/g, "_");
  await set(ref(db, `fcmTokens/${uid}/${safe}`), true);
}