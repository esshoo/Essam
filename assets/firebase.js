import { FIREBASE_CONFIG } from "./app-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  push,
  update,
  onValue,
  serverTimestamp,
  query,
  orderByChild,
  equalTo
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

// ✅ تثبيت الجلسة (يمنع تذبذب الحالة بين null/user)
const authReady = setPersistence(auth, browserLocalPersistence).catch(() => {
  // لو المتصفح منعها لأي سبب، هنكمل بدون ما نكسر التطبيق
});

export {
  app, auth, db, authReady,
  GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut, onAuthStateChanged,
  ref, get, set, push, update, onValue, serverTimestamp, query, orderByChild, equalTo,
  getMessaging, getToken, onMessage, isSupported
};
