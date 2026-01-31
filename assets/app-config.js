// ضع إعدادات Firebase هنا بعد إنشاء المشروع في Firebase Console
// IMPORTANT: لا تنسَ وضع نفس FIREBASE_CONFIG داخل firebase-messaging-sw.js أيضًا

export const FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_AUTH_DOMAIN",
  databaseURL: "PASTE_DATABASE_URL",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_STORAGE_BUCKET",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// VAPID key من Cloud Messaging -> Web Push certificates
export const FCM_VAPID_KEY = "PASTE_VAPID_KEY";

// إعدادات عامة
export const APP = {
  name: "Essam Support",
  version: "2.0.0"
};
