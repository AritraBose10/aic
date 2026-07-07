"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserDoc } from "@/core/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userDoc: UserDoc | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userDoc: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      unsubscribeDoc?.();

      if (!user) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubscribeDoc = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null);
          setLoading(false);
        },
        (error) => {
          // Without an error callback a listener failure (permission-denied,
          // stream error) would leave loading=true forever -> permanent spinner.
          // Resolve to a signed-out-shaped state so the app can redirect/recover.
          console.error("user doc listener error", error);
          setUserDoc(null);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDoc?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, userDoc, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
