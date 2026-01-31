import { auth, isSupported, getMessaging, getToken, onMessage } from "./firebase.js";
import { FCM_VAPID_KEY } from "./app-config.js";
import { toast } from "./ui.js";
import { saveFcmToken } from "./db.js";

let messaging = null;

export async function initMessaging(){
  const supported = await isSupported().catch(()=>false);
  if(!supported){
    console.warn("FCM not supported in this browser.");
    return null;
  }
  messaging = getMessaging();
  onMessage(messaging, (payload)=>{
    const t = payload?.notification?.title || "إشعار";
    const b = payload?.notification?.body || "";
    toast(t,b);
  });
  return messaging;
}

export async function enableNotifications(){
  const user = auth.currentUser;
  if(!user) throw new Error("Not authenticated");

  const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js");

  const perm = await Notification.requestPermission();
  if(perm !== "granted"){
    throw new Error("Notification permission not granted");
  }
  if(!messaging) await initMessaging();
  if(!messaging) throw new Error("Messaging unsupported");

  const token = await getToken(messaging, {
  vapidKey: FCM_VAPID_KEY,
  serviceWorkerRegistration: reg
});
  if(token){
    await saveFcmToken(user.uid, token);
    toast("تم تفعيل الإشعارات", "سيتم إرسال تنبيهات عند وجود تحديثات.");
  }else{
    throw new Error("No token returned");
  }
}

export function wireNotificationButton(btnSelector="#btnEnableNotifs"){
  const btn = document.querySelector(btnSelector);
  if(!btn) return;
  btn.addEventListener("click", async ()=>{
    btn.disabled = true;
    try{
      await enableNotifications();
    }catch(e){
      console.error(e);
      toast("تعذّر تفعيل الإشعارات", e?.message || "حاول مرة أخرى");
    }finally{
      btn.disabled = false;
    }
  });
}
