import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

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

export async function runRetentionCleanup(db: Firestore): Promise<{ deletedRejectedApps: number; deletedAiLogs: number; flaggedInactiveStartups: number }> {
  const now = Date.now();
  let deletedRejectedApps = 0, deletedAiLogs = 0, flaggedInactiveStartups = 0;

  // Rejected applications past TTL → delete.
  const rejected = await db.collection("applications")
    .where("status", "==", "rejected")
    .where("updatedAt", "<", Timestamp.fromMillis(now - REJECTED_APP_TTL)).get();
  for (const d of rejected.docs) { await d.ref.delete(); deletedRejectedApps++; }

  // AI usage logs past TTL → delete.
  const oldLogs = await db.collection("aiUsage")
    .where("at", "<", Timestamp.fromMillis(now - AI_LOG_TTL)).get();
  for (const d of oldLogs.docs) { await d.ref.delete(); deletedAiLogs++; }

  // Inactive startups → flag (not delete). Skip incubated + alumni.
  const stale = await db.collection("startups")
    .where("updatedAt", "<", Timestamp.fromMillis(now - INACTIVE_STARTUP_TTL)).get();
  for (const d of stale.docs) {
    const s = d.data();
    if (s.incubation || s.alumni || s.retentionFlagged) continue;
    await d.ref.update({ retentionFlagged: true });
    flaggedInactiveStartups++;
  }

  await db.collection("auditLog").add({
    actorId: "system", actorRole: "system", action: "retention.cleanup", entityType: "user", entityId: "system",
    details: { deletedRejectedApps, deletedAiLogs, flaggedInactiveStartups }, timestamp: FieldValue.serverTimestamp(),
  });
  return { deletedRejectedApps, deletedAiLogs, flaggedInactiveStartups };
}

/** Scheduled daily cleanup — Blaze (Cloud Scheduler). Deploys at cutover. */
export const retentionCleanup = onSchedule("every 24 hours", async () => {
  await runRetentionCleanup(getFirestore());
});

/** Admin manual trigger (testable without scheduling). */
export const runRetentionCleanupNow = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await getFirestore().doc(`users/${req.auth.uid}`).get();
  if ((snap.data() as { role?: string })?.role !== "admin") throw new HttpsError("permission-denied", "Admin only.");
  return runRetentionCleanup(getFirestore());
});

/**
 * §9.2 data-subject request — self-service account deactivation. Freezes access
 * (approvalStatus rejected + deactivated flag) and revokes all sessions. Needs
 * the Admin SDK (writes protected user fields + revokes tokens) → Blaze.
 * Data is retained (not purged) so audit/outcome history stays intact; a hard
 * erasure request would be a separate admin action.
 */
export const deactivateAccount = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = req.auth.uid;
  const db = getFirestore();
  await db.doc(`users/${uid}`).update({
    deactivated: true,
    approvalStatus: "rejected",
    deactivatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await getAuth().revokeRefreshTokens(uid);
  await db.collection("auditLog").add({
    actorId: uid, actorRole: "self", action: "user.deactivate", entityType: "user", entityId: uid,
    details: { selfService: true }, timestamp: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
