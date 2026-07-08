import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

/**
 * SEC-05 — revoke all refresh tokens for the calling user ("sign out of all
 * devices"). Requires the Admin SDK, so this is a Blaze-gated Cloud Function.
 * The current device's ID token stays valid until it expires (≤1h); other
 * devices lose access on their next token refresh.
 */
export const revokeMySessions = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = req.auth.uid;
  await getAuth().revokeRefreshTokens(uid);
  await getFirestore().collection("auditLog").add({
    actorId: uid,
    actorRole: "self",
    action: "user.session_revoke",
    entityType: "user",
    entityId: uid,
    details: { sessionRevoke: true },
    timestamp: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
