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
