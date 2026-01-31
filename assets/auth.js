import { auth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut, onAuthStateChanged } from "./firebase.js";

export async function loginGoogle(){
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

export async function loginGuest(){
  const res = await signInAnonymously(auth);
  return res.user;
}

export async function logout(){
  await signOut(auth);
}

export function onUser(cb){
  return onAuthStateChanged(auth, cb);
}

export function requireAuth(redirectTo="index.html"){
  return new Promise((resolve)=>{
    onAuthStateChanged(auth, (u)=>{
      if(!u){
        location.href = redirectTo;
        return;
      }
      resolve(u);
    });
  });
}
