import {
  auth,
  authReady,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from "./firebase.js";

export async function loginGoogle() {
  await authReady;
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

export async function loginGuest() {
  await authReady;
  // ✅ Reuse existing anonymous session to keep a stable UID
  // Calling signInAnonymously repeatedly can create a new UID each time.
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    return auth.currentUser;
  }
  const res = await signInAnonymously(auth);
  return res.user;
}

export async function logout() {
  await authReady;
  await signOut(auth);
}

export function onUser(cb) {
  return onAuthStateChanged(auth, cb);
}

/**
 * ينتظر تهيئة Auth ثم يرجع المستخدم.
 * لو لم يوجد مستخدم بعد مهلة قصيرة، يعمل redirect مرة واحدة.
 */
export async function requireAuth(redirectTo = "index.html", waitMs = 1200) {
  await authReady;

  return new Promise((resolve) => {
    let done = false;
    let timer = null;

    const unsub = onAuthStateChanged(auth, (u) => {
      if (done) return;

      if (u) {
        done = true;
        if (timer) clearTimeout(timer);
        unsub();
        resolve(u);
        return;
      }

      if (!timer) {
        timer = setTimeout(() => {
          if (done) return;
          done = true;
          unsub();
          location.replace(redirectTo);
        }, waitMs);
      }
    });
  });
}
