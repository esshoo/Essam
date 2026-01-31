/* Firebase Messaging Service Worker (FCM)
   IMPORTANT: ضع نفس firebaseConfig المستخدمة في assets/app-config.js هنا أيضاً.
*/
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyCV6xsRfSlpt5t9YNCVIivxJoRwj1TIexs",
  authDomain: "essam-support.firebaseapp.com",
  databaseURL: "https://essam-support-default-rtdb.firebaseio.com",
  projectId: "essam-support",
  storageBucket: "essam-support.firebasestorage.app",
  messagingSenderId: "1062222968750",
  appId: "1:1062222968750:web:1c827c20729f76fbe7ba3f"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

/** Resolve base path from SW scope, e.g. "/Essam/" on GitHub Pages */
function getBasePath() {
  // self.registration.scope example: "https://esshoo.github.io/Essam/"
  const u = new URL(self.registration.scope);
  return u.pathname.endsWith("/") ? u.pathname : (u.pathname + "/");
}

messaging.onBackgroundMessage((payload) => {
  const BASE = getBasePath();

  const title =
    (payload && payload.notification && payload.notification.title) || "إشعار";

  const options = {
    body: (payload && payload.notification && payload.notification.body) || "",
    icon: BASE + "icons/icon-192.png",
    badge: BASE + "icons/icon-192.png",
    data: payload?.data || {}
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const BASE = getBasePath();

  // url may be relative or absolute
  const raw = event.notification?.data?.url || (BASE + "index.html");
  const target = new URL(raw, self.registration.scope).toString();

  event.waitUntil(clients.openWindow(target));
});
