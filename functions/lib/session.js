"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeMySessions = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
/**
 * SEC-05 — revoke all refresh tokens for the calling user ("sign out of all
 * devices"). Requires the Admin SDK, so this is a Blaze-gated Cloud Function.
 * The current device's ID token stays valid until it expires (≤1h); other
 * devices lose access on their next token refresh.
 */
exports.revokeMySessions = (0, https_1.onCall)(async (req) => {
    if (!req.auth)
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    const uid = req.auth.uid;
    await (0, auth_1.getAuth)().revokeRefreshTokens(uid);
    await (0, firestore_1.getFirestore)().collection("auditLog").add({
        actorId: uid,
        actorRole: "self",
        action: "user.session_revoke",
        entityType: "user",
        entityId: uid,
        details: { sessionRevoke: true },
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
