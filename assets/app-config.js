// ضع إعدادات Firebase هنا بعد إنشاء المشروع في Firebase Console
// IMPORTANT: لا تنسَ وضع نفس FIREBASE_CONFIG داخل firebase-messaging-sw.js أيضًا

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCV6xsRfSlpt5t9YNCVIivxJoRwj1TIexs",
  authDomain: "essam-support.firebaseapp.com",
  databaseURL: "https://essam-support-default-rtdb.firebaseio.com",
  projectId: "essam-support",
  storageBucket: "essam-support.firebasestorage.app",
  messagingSenderId: "1062222968750",
  appId: "1:1062222968750:web:1c827c20729f76fbe7ba3f"
};

// VAPID key من Cloud Messaging -> Web Push certificates
export const FCM_VAPID_KEY = "BM_9wA4K71mBVFFcjijVxxW4piChUT1wxZC77_nBu3J-qq-AXtNxLImt5zyghkYjLpSfXpamiaXsuyG-ZO7I-t0";

// إعدادات عامة
export const APP = {
  name: "Essam Support",
  version: "2.0.0"
};
