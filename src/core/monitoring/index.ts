import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

/**
 * NFR-12 — lightweight, Firebase-native error monitoring. Persists uncaught
 * client errors to an admin-readable `errorLogs` collection (append-only) so
 * failures are visible without a third-party service. Deliberately minimal:
 * a real alerting integration (Sentry/Crashlytics) can layer on later.
 */
export async function logClientError(error: unknown, context?: string): Promise<void> {
  try {
    if (typeof window === "undefined" || !auth?.currentUser) return; // authed client errors only
    const err = error instanceof Error ? error : new Error(String(error));
    await addDoc(collection(db, "errorLogs"), {
      message: err.message.slice(0, 500),
      stack: (err.stack ?? "").slice(0, 2000),
      context: context ?? null,
      url: window.location.pathname,
      userAgent: navigator.userAgent.slice(0, 300),
      uid: auth.currentUser.uid,
      at: serverTimestamp(),
    });
  } catch {
    // Never let error logging throw.
  }
}
