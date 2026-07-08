"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateAccount = exports.runRetentionCleanupNow = exports.retentionCleanup = void 0;
exports.runRetentionCleanup = runRetentionCleanup;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
/**
 * §9.2 Retention & deletion policy (NFR — data governance).
 *
 * Policy (documented + enforced here):
 *  - Rejected applications: deleted 180 days after rejection.
 *  - AI usage logs (aiUsage): deleted after 365 days.
 *  - Inactive startups (never incubated, no alumni record, untouched 365 days):
 *    FLAGGED for admin review (retentionFlagged), never auto-deleted — deleting
 *    a startup would cascade ownership; a human decides.
 *  - Alumni / graduated data + KPI snapshots: RETAINED indefinitely (MIS-07
 *    requires historical outcome snapshots) — never touched by cleanup.
 *
 * The scheduled trigger (`retentionCleanup`) needs Cloud Scheduler = Blaze, so it
 * deploys at the cutover. `runRetentionCleanupNow` is an admin-callable that runs
 * the same logic for manual runs + emulator testing without scheduling.
 */
const DAY = 24 * 60 * 60 * 1000;
const REJECTED_APP_TTL = 180 * DAY;
const AI_LOG_TTL = 365 * DAY;
const INACTIVE_STARTUP_TTL = 365 * DAY;
async function runRetentionCleanup(db) {
    const now = Date.now();
    let deletedRejectedApps = 0, deletedAiLogs = 0, flaggedInactiveStartups = 0;
    // Rejected applications past TTL → delete.
    const rejected = await db.collection("applications")
        .where("status", "==", "rejected")
        .where("updatedAt", "<", firestore_1.Timestamp.fromMillis(now - REJECTED_APP_TTL)).get();
    for (const d of rejected.docs) {
        await d.ref.delete();
        deletedRejectedApps++;
    }
    // AI usage logs past TTL → delete.
    const oldLogs = await db.collection("aiUsage")
        .where("at", "<", firestore_1.Timestamp.fromMillis(now - AI_LOG_TTL)).get();
    for (const d of oldLogs.docs) {
        await d.ref.delete();
        deletedAiLogs++;
    }
    // Inactive startups → flag (not delete). Skip incubated + alumni.
    const stale = await db.collection("startups")
        .where("updatedAt", "<", firestore_1.Timestamp.fromMillis(now - INACTIVE_STARTUP_TTL)).get();
    for (const d of stale.docs) {
        const s = d.data();
        if (s.incubation || s.alumni || s.retentionFlagged)
            continue;
        await d.ref.update({ retentionFlagged: true });
        flaggedInactiveStartups++;
    }
    await db.collection("auditLog").add({
        actorId: "system", actorRole: "system", action: "retention.cleanup", entityType: "user", entityId: "system",
        details: { deletedRejectedApps, deletedAiLogs, flaggedInactiveStartups }, timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { deletedRejectedApps, deletedAiLogs, flaggedInactiveStartups };
}
/** Scheduled daily cleanup — Blaze (Cloud Scheduler). Deploys at cutover. */
exports.retentionCleanup = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    await runRetentionCleanup((0, firestore_1.getFirestore)());
});
/** Admin manual trigger (testable without scheduling). */
exports.runRetentionCleanupNow = (0, https_1.onCall)(async (req) => {
    if (!req.auth)
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    const snap = await (0, firestore_1.getFirestore)().doc(`users/${req.auth.uid}`).get();
    if (snap.data()?.role !== "admin")
        throw new https_1.HttpsError("permission-denied", "Admin only.");
    return runRetentionCleanup((0, firestore_1.getFirestore)());
});
/**
 * §9.2 data-subject request — self-service account deactivation. Freezes access
 * (approvalStatus rejected + deactivated flag) and revokes all sessions. Needs
 * the Admin SDK (writes protected user fields + revokes tokens) → Blaze.
 * Data is retained (not purged) so audit/outcome history stays intact; a hard
 * erasure request would be a separate admin action.
 */
exports.deactivateAccount = (0, https_1.onCall)(async (req) => {
    if (!req.auth)
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    const uid = req.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    await db.doc(`users/${uid}`).update({
        deactivated: true,
        approvalStatus: "rejected",
        deactivatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await (0, auth_1.getAuth)().revokeRefreshTokens(uid);
    await db.collection("auditLog").add({
        actorId: uid, actorRole: "self", action: "user.deactivate", entityType: "user", entityId: uid,
        details: { selfService: true }, timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
