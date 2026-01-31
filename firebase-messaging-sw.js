/* Firebase Messaging Service Worker (FCM)
   IMPORTANT: ضع نفس firebaseConfig المستخدمة في assets/app-config.js هنا أيضاً.
*/
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_AUTH_DOMAIN",
  databaseURL: "PASTE_DATABASE_URL",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_STORAGE_BUCKET",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload && payload.notification && payload.notification.title) || "إشعار";
  const options = {
    body: (payload && payload.notification && payload.notification.body) || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    data: payload?.data || {}
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event)=>{
  event.notification.close();
  const url = event.notification?.data?.url || "./index.html";
  event.waitUntil(clients.openWindow(url));
});
