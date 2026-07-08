import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";

/** Idle window before auto sign-out (SEC-05). */
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

function fingerprint(ua: string): string {
  // Small stable hash of the user-agent — a coarse "device" identity, not PII.
  let h = 5381;
  for (let i = 0; i < ua.length; i++) h = ((h << 5) + h + ua.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * SEC-05 suspicious-login signal: record a login and flag a first-seen device.
 * Reads/writes only the caller's own loginEvents (rules enforce this). A truly
 * server-side new-device/geo detector would need an auth trigger (Blaze) — this
 * is the pilot-level client detection.
 */
export async function recordLoginEvent(uid: string): Promise<{ isNewDevice: boolean }> {
  if (typeof navigator === "undefined") return { isNewDevice: false };
  const fp = fingerprint(navigator.userAgent);
  const prior = await getDocs(query(collection(db, "loginEvents"), where("uid", "==", uid)));
  const seen = prior.docs.some((d) => d.data().fingerprint === fp);
  if (!seen) {
    await addDoc(collection(db, "loginEvents"), {
      uid,
      fingerprint: fp,
      userAgent: navigator.userAgent.slice(0, 300),
      at: serverTimestamp(),
    });
  }
  return { isNewDevice: !seen && prior.size > 0 };
}

/**
 * SEC-05 session revocation ("sign out of all devices"). Requires the Admin SDK
 * (`revokeRefreshTokens`) — a Blaze-gated Cloud Function. Signing out the CURRENT
 * device is always available via logoutUser(); this revokes the others too.
 */
export async function revokeMySessions(): Promise<{ ok: boolean }> {
  const fn = httpsCallable<Record<string, never>, { ok: boolean }>(functions, "revokeMySessions");
  return (await fn({})).data;
}
