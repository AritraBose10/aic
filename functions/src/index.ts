import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Transaction } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

// core/ai — server-side Claude wrapper for AI outreach (Blaze-gated, emulator-testable).
export { generateOutreachDraft } from "./ai";

// core/search — permission-aware AI search / RAG (Blaze-gated, emulator-testable).
export { searchQuery } from "./search";
// Duplicate identity merge (IDM-02) — Admin SDK reference rewrite (Blaze-gated).
export { mergeIdentities } from "./merge";
// SEC-05 session revocation + §9.2 retention cleanup + data-subject deactivation (Blaze-gated).
export { revokeMySessions } from "./session";
export { retentionCleanup, runRetentionCleanupNow, deactivateAccount } from "./retention";
// core/search indexer — Firestore triggers that maintain the searchIndex (Blaze-gated).
export {
  indexStartup,
  indexInvestorProfile,
  indexDocument,
  indexApplication,
  indexAdoptionWorkspace,
  indexDealEntry,
} from "./searchIndexer";

type Role = "admin" | "cohort_manager" | "evaluator" | "founder";

interface Actor {
  uid: string;
  role: Role;
}

/** Resolve + authorize the caller from their (server-trusted) auth uid. */
async function requireApprovedUser(req: CallableRequest, roles: Role[]): Promise<Actor> {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await db.doc(`users/${req.auth.uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "No user profile.");
  const user = snap.data() as { role: Role; approvalStatus: string };
  if (user.approvalStatus !== "approved") {
    throw new HttpsError("permission-denied", "Account not approved.");
  }
  if (!roles.includes(user.role)) {
    throw new HttpsError("permission-denied", "You do not have permission for this action.");
  }
  return { uid: req.auth.uid, role: user.role };
}

function writeAudit(
  tx: Transaction,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
) {
  tx.set(db.collection("auditLog").doc(), {
    actorId: actor.uid,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    details: details ?? null,
    timestamp: FieldValue.serverTimestamp(),
  });
}

/**
 * Server-authoritative committee decision. Enforces, inside an Admin
 * transaction that the client cannot bypass:
 *  - only an admin may alter/reopen a LOCKED decision,
 *  - an ineligible application cannot be selected,
 *  - cohort capacity (via the transactional selectedCount counter),
 *  - onboarding is opened on select and rescinded on reversal,
 *  - private notes stay in a staff-only subcollection,
 *  - an immutable audit entry with the server-verified actor.
 */
export const recordDecision = onCall(async (req) => {
  const { applicationId, decision, notes } = (req.data ?? {}) as {
    applicationId?: string;
    decision?: string;
    notes?: string;
  };
  if (typeof applicationId !== "string" || !applicationId) {
    throw new HttpsError("invalid-argument", "applicationId is required.");
  }
  if (decision !== "selected" && decision !== "rejected" && decision !== "waitlisted") {
    throw new HttpsError("invalid-argument", "Invalid decision.");
  }
  const actor = await requireApprovedUser(req, ["admin", "cohort_manager"]);

  await db.runTransaction(async (tx) => {
    const appRef = db.doc(`applications/${applicationId}`);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists) throw new HttpsError("not-found", "Application not found.");
    const application = appSnap.data() as {
      cohortId: string;
      cohortName: string;
      startupId: string;
      status: string;
      isEligible: boolean | null;
      committeeDecision?: { locked?: boolean };
    };

    const locked = application.committeeDecision?.locked === true;
    if (locked && actor.role !== "admin") {
      throw new HttpsError("permission-denied", "This decision is locked — only an admin may change it.");
    }

    const cohortRef = db.doc(`cohorts/${application.cohortId}`);
    const startupRef = db.doc(`startups/${application.startupId}`);
    const cohortSnap = await tx.get(cohortRef);
    const startupSnap = await tx.get(startupRef);

    const wasSelected = application.status === "selected";
    const willSelect = decision === "selected";

    if (willSelect && application.isEligible === false) {
      throw new HttpsError("failed-precondition", "Application is marked ineligible.");
    }
    if (willSelect && !wasSelected) {
      const cohort = cohortSnap.data() as { capacity?: number; selectedCount?: number } | undefined;
      const capacity = cohort?.capacity ?? 0;
      const selectedCount = cohort?.selectedCount ?? 0;
      if (selectedCount >= capacity) {
        throw new HttpsError("resource-exhausted", "This cohort is already at capacity.");
      }
    }

    tx.update(appRef, {
      status: decision,
      committeeDecision: { decision, decidedAt: FieldValue.serverTimestamp(), locked: true },
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(db.doc(`applications/${applicationId}/review/decision`), {
      decidedBy: actor.uid,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      decidedAt: FieldValue.serverTimestamp(),
    });

    const delta = willSelect && !wasSelected ? 1 : !willSelect && wasSelected ? -1 : 0;
    if (delta !== 0) tx.update(cohortRef, { selectedCount: FieldValue.increment(delta) });

    const startup = startupSnap.exists
      ? (startupSnap.data() as { incubation?: { applicationId?: string } })
      : null;
    if (willSelect && startup && !startup.incubation) {
      tx.update(startupRef, {
        incubation: {
          cohortId: application.cohortId,
          cohortName: application.cohortName,
          applicationId,
          onboarding: {
            acceptedOffer: false,
            consentGiven: false,
            baselineKpiCaptured: false,
            orientationComplete: false,
            founderVerified: false,
          },
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (!willSelect && startup?.incubation?.applicationId === applicationId) {
      tx.update(startupRef, { incubation: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    }

    writeAudit(tx, actor, "application.decide", "application", applicationId, { decision });
  });

  return { ok: true };
});

/** Admin-only: reopen a locked committee decision. */
export const reopenDecision = onCall(async (req) => {
  const { applicationId } = (req.data ?? {}) as { applicationId?: string };
  if (typeof applicationId !== "string" || !applicationId) {
    throw new HttpsError("invalid-argument", "applicationId is required.");
  }
  const actor = await requireApprovedUser(req, ["admin"]);

  await db.runTransaction(async (tx) => {
    const appRef = db.doc(`applications/${applicationId}`);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists) throw new HttpsError("not-found", "Application not found.");
    const application = appSnap.data() as { committeeDecision?: unknown };
    if (!application.committeeDecision) return;
    tx.update(appRef, { "committeeDecision.locked": false, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, actor, "application.reopen", "application", applicationId);
  });

  return { ok: true };
});

/**
 * Server-authoritative submission. Enforces cohort open + deadline + ownership
 * + completeness before flipping the application to `submitted`, so a crafted
 * client write can't submit past the deadline.
 */
export const submitApplication = onCall(async (req) => {
  const { applicationId } = (req.data ?? {}) as { applicationId?: string };
  if (typeof applicationId !== "string" || !applicationId) {
    throw new HttpsError("invalid-argument", "applicationId is required.");
  }
  const actor = await requireApprovedUser(req, ["founder"]);

  await db.runTransaction(async (tx) => {
    const appRef = db.doc(`applications/${applicationId}`);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists) throw new HttpsError("not-found", "Application not found.");
    const application = appSnap.data() as {
      founderId: string;
      cohortId: string;
      status: string;
      pitchSummary: string;
      documentUrls: string[];
    };

    if (application.founderId !== actor.uid) {
      throw new HttpsError("permission-denied", "Not your application.");
    }
    if (application.status !== "draft") {
      throw new HttpsError("failed-precondition", "Application is not a draft.");
    }

    const cohortSnap = await tx.get(db.doc(`cohorts/${application.cohortId}`));
    if (!cohortSnap.exists) throw new HttpsError("not-found", "Cohort not found.");
    const cohort = cohortSnap.data() as { status: string; applicationCloseAt: { toMillis(): number } };
    if (cohort.status !== "open") {
      throw new HttpsError("failed-precondition", "This cohort is not open for applications.");
    }
    if (cohort.applicationCloseAt.toMillis() < Date.now()) {
      throw new HttpsError("failed-precondition", "The application deadline has passed.");
    }

    const complete =
      application.pitchSummary.trim().length > 0 && (application.documentUrls[0]?.trim().length ?? 0) > 0;
    if (!complete) {
      throw new HttpsError("failed-precondition", "Complete the pitch summary and deck link first.");
    }

    tx.update(appRef, {
      status: "submitted",
      isComplete: true,
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    writeAudit(tx, actor, "application.submit", "application", applicationId);
  });

  return { ok: true };
});
