import { FIREBASE_CONFIG } from "./app-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getDatabase, ref, get, set, push, update, onValue, serverTimestamp, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

export {
  app, auth, db,
  GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut, onAuthStateChanged,
  ref, get, set, push, update, onValue, serverTimestamp, query, orderByChild, equalTo,
  getMessaging, getToken, onMessage, isSupported
};
