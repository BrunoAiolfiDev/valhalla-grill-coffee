"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  guestName: string | null;
  loading: boolean;
  displayName: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
  ) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  continueAsGuest: (name: string) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore guest name from localStorage (async via callback to avoid synchronous setState)
    const saved = localStorage.getItem("valhalla_guest_name");

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser && saved) setGuestName(saved);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUpWithEmail(
    name: string,
    email: string,
    password: string,
  ) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    // Force refresh so displayName propagates immediately
    setUser({ ...cred.user, displayName: name } as User);
  }

  async function sendPasswordReset(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  function continueAsGuest(name: string) {
    localStorage.setItem("valhalla_guest_name", name);
    setGuestName(name);
  }

  async function logout() {
    await signOut(auth);
    localStorage.removeItem("valhalla_guest_name");
    setGuestName(null);
  }

  const displayName = user?.displayName ?? guestName;

  return (
    <AuthContext.Provider
      value={{
        user,
        guestName,
        loading,
        displayName,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        continueAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
