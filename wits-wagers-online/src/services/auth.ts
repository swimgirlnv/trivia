import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";

export async function ensureAnonAuth(): Promise<User> {
  const cur = auth.currentUser;
  if (cur) return cur;
  const res = await signInAnonymously(auth);
  return res.user;
}

export function onAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
