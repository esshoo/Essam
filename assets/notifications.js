import { auth, isSupported, getMessaging, getToken, onMessage } from "./firebase.js";
import { FCM_VAPID_KEY } from "./app-config.js";
import { toast } from "./ui.js";
import { saveFcmToken } from "./db.js";

let messaging = null;

/**
 * Resolve the app base path automatically.
 * Example: if this file is served from https://esshoo.github.io/Essam/assets/notifications.js
 * then BASE_PATH becomes "/Essam/"
 */
function getBasePath() {
  // ../ from /Essam/assets/ => /Essam/
  const baseUrl = new URL("../", import.meta.url);
  return baseUrl.pathname.endsWith("/") ? baseUrl.pathname : (baseUrl.pathname + "/");
}

function assertValidVapidKey(vapidKey) {
  const k = (vapidKey || "").trim();
  // Typical VAPID public keys are long and start with "B..."
  if (!k || k.includes("PASTE") || k.length < 40) {
    throw new Error(
      "VAPID Key غير صحيح. انسخ (Web Push certificates → Key pair) من Firebase ثم ضعها في FCM_VAPID_KEY داخل app-config.js"
    );
  }
  return k;
}

async function ensureServiceWorkerRegistered() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker غير مدعوم في هذا المتصفح.");
  }

  const BASE_PATH = getBasePath();
  const swUrl = new URL("firebase-messaging-sw.js", new URL(BASE_PATH, location.origin)).toString();

  // Try to reuse existing registration for this scope
  const existing = await navigator.serviceWorker.getRegistration(BASE_PATH);
  if (existing) return existing;

  // Register with correct scope for GitHub Pages subpath
  const reg = await navigator.serviceWorker.register(swUrl, { scope: BASE_PATH });

  // Make sure SW is ready (helps prevent timing issues)
  await navigator.serviceWorker.ready;
  return reg;
}

export async function initMessaging() {
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn("FCM not supported in this browser.");
    return null;
  }

  messaging = getMessaging();
  onMessage(messaging, (payload) => {
    const t = payload?.notification?.title || "إشعار";
    const b = payload?.notification?.body || "";
    toast(t, b);
  });

  return messaging;
}

export async function enableNotifications() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  // 1) Ensure SW is registered under the correct GitHub Pages scope
  const reg = await ensureServiceWorkerRegistered();

  // 2) Ask permission (must be user-initiated click)
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error("لم يتم منح إذن الإشعارات.");
  }

  // 3) Init messaging
  if (!messaging) await initMessaging();
  if (!messaging) throw new Error("Messaging unsupported");

  // 4) Validate VAPID + get token
  const vapidKey = assertValidVapidKey(FCM_VAPID_KEY);

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: reg
  });

  if (token) {
    await saveFcmToken(user.uid, token);
    toast("تم تفعيل الإشعارات", "سيتم إرسال تنبيهات عند وجود تحديثات.");
  } else {
    throw new Error("لم يتم الحصول على Token من FCM.");
  }
}

export function wireNotificationButton(btnSelector = "#btnEnableNotifs") {
  const btn = document.querySelector(btnSelector);
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await enableNotifications();
    } catch (e) {
      console.error(e);
      toast("تعذّر تفعيل الإشعارات", e?.message || "حاول مرة أخرى");
    } finally {
      btn.disabled = false;
    }
  });
}
