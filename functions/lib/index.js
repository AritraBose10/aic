"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitApplication = exports.reopenDecision = exports.recordDecision = exports.indexDealEntry = exports.indexAdoptionWorkspace = exports.indexApplication = exports.indexDocument = exports.indexInvestorProfile = exports.indexStartup = exports.deactivateAccount = exports.runRetentionCleanupNow = exports.retentionCleanup = exports.revokeMySessions = exports.mergeIdentities = exports.searchQuery = exports.generateOutreachDraft = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// core/ai — server-side Claude wrapper for AI outreach (Blaze-gated, emulator-testable).
var ai_1 = require("./ai");
Object.defineProperty(exports, "generateOutreachDraft", { enumerable: true, get: function () { return ai_1.generateOutreachDraft; } });
// core/search — permission-aware AI search / RAG (Blaze-gated, emulator-testable).
var search_1 = require("./search");
Object.defineProperty(exports, "searchQuery", { enumerable: true, get: function () { return search_1.searchQuery; } });
// Duplicate identity merge (IDM-02) — Admin SDK reference rewrite (Blaze-gated).
var merge_1 = require("./merge");
Object.defineProperty(exports, "mergeIdentities", { enumerable: true, get: function () { return merge_1.mergeIdentities; } });
// SEC-05 session revocation + §9.2 retention cleanup + data-subject deactivation (Blaze-gated).
var session_1 = require("./session");
Object.defineProperty(exports, "revokeMySessions", { enumerable: true, get: function () { return session_1.revokeMySessions; } });
var retention_1 = require("./retention");
Object.defineProperty(exports, "retentionCleanup", { enumerable: true, get: function () { return retention_1.retentionCleanup; } });
Object.defineProperty(exports, "runRetentionCleanupNow", { enumerable: true, get: function () { return retention_1.runRetentionCleanupNow; } });
Object.defineProperty(exports, "deactivateAccount", { enumerable: true, get: function () { return retention_1.deactivateAccount; } });
// core/search indexer — Firestore triggers that maintain the searchIndex (Blaze-gated).
var searchIndexer_1 = require("./searchIndexer");
Object.defineProperty(exports, "indexStartup", { enumerable: true, get: function () { return searchIndexer_1.indexStartup; } });
Object.defineProperty(exports, "indexInvestorProfile", { enumerable: true, get: function () { return searchIndexer_1.indexInvestorProfile; } });
Object.defineProperty(exports, "indexDocument", { enumerable: true, get: function () { return searchIndexer_1.indexDocument; } });
Object.defineProperty(exports, "indexApplication", { enumerable: true, get: function () { return searchIndexer_1.indexApplication; } });
Object.defineProperty(exports, "indexAdoptionWorkspace", { enumerable: true, get: function () { return searchIndexer_1.indexAdoptionWorkspace; } });
Object.defineProperty(exports, "indexDealEntry", { enumerable: true, get: function () { return searchIndexer_1.indexDealEntry; } });
/** Resolve + authorize the caller from their (server-trusted) auth uid. */
async function requireApprovedUser(req, roles) {
    if (!req.auth)
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    const snap = await db.doc(`users/${req.auth.uid}`).get();
    if (!snap.exists)
        throw new https_1.HttpsError("permission-denied", "No user profile.");
    const user = snap.data();
    if (user.approvalStatus !== "approved") {
        throw new https_1.HttpsError("permission-denied", "Account not approved.");
    }
    if (!roles.includes(user.role)) {
        throw new https_1.HttpsError("permission-denied", "You do not have permission for this action.");
    }
    return { uid: req.auth.uid, role: user.role };
}
function writeAudit(tx, actor, action, entityType, entityId, details) {
    tx.set(db.collection("auditLog").doc(), {
        actorId: actor.uid,
        actorRole: actor.role,
        action,
        entityType,
        entityId,
        details: details ?? null,
        timestamp: firestore_1.FieldValue.serverTimestamp(),
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
exports.recordDecision = (0, https_1.onCall)(async (req) => {
    const { applicationId, decision, notes } = (req.data ?? {});
    if (typeof applicationId !== "string" || !applicationId) {
        throw new https_1.HttpsError("invalid-argument", "applicationId is required.");
    }
    if (decision !== "selected" && decision !== "rejected" && decision !== "waitlisted") {
        throw new https_1.HttpsError("invalid-argument", "Invalid decision.");
    }
    const actor = await requireApprovedUser(req, ["admin", "cohort_manager"]);
    await db.runTransaction(async (tx) => {
        const appRef = db.doc(`applications/${applicationId}`);
        const appSnap = await tx.get(appRef);
        if (!appSnap.exists)
            throw new https_1.HttpsError("not-found", "Application not found.");
        const application = appSnap.data();
        const locked = application.committeeDecision?.locked === true;
        if (locked && actor.role !== "admin") {
            throw new https_1.HttpsError("permission-denied", "This decision is locked — only an admin may change it.");
        }
        const cohortRef = db.doc(`cohorts/${application.cohortId}`);
        const startupRef = db.doc(`startups/${application.startupId}`);
        const cohortSnap = await tx.get(cohortRef);
        const startupSnap = await tx.get(startupRef);
        const wasSelected = application.status === "selected";
        const willSelect = decision === "selected";
        if (willSelect && application.isEligible === false) {
            throw new https_1.HttpsError("failed-precondition", "Application is marked ineligible.");
        }
        if (willSelect && !wasSelected) {
            const cohort = cohortSnap.data();
            const capacity = cohort?.capacity ?? 0;
            const selectedCount = cohort?.selectedCount ?? 0;
            if (selectedCount >= capacity) {
                throw new https_1.HttpsError("resource-exhausted", "This cohort is already at capacity.");
            }
        }
        tx.update(appRef, {
            status: decision,
            committeeDecision: { decision, decidedAt: firestore_1.FieldValue.serverTimestamp(), locked: true },
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.set(db.doc(`applications/${applicationId}/review/decision`), {
            decidedBy: actor.uid,
            notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
            decidedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        const delta = willSelect && !wasSelected ? 1 : !willSelect && wasSelected ? -1 : 0;
        if (delta !== 0)
            tx.update(cohortRef, { selectedCount: firestore_1.FieldValue.increment(delta) });
        const startup = startupSnap.exists
            ? startupSnap.data()
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
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        else if (!willSelect && startup?.incubation?.applicationId === applicationId) {
            tx.update(startupRef, { incubation: firestore_1.FieldValue.delete(), updatedAt: firestore_1.FieldValue.serverTimestamp() });
        }
        writeAudit(tx, actor, "application.decide", "application", applicationId, { decision });
    });
    return { ok: true };
});
/** Admin-only: reopen a locked committee decision. */
exports.reopenDecision = (0, https_1.onCall)(async (req) => {
    const { applicationId } = (req.data ?? {});
    if (typeof applicationId !== "string" || !applicationId) {
        throw new https_1.HttpsError("invalid-argument", "applicationId is required.");
    }
    const actor = await requireApprovedUser(req, ["admin"]);
    await db.runTransaction(async (tx) => {
        const appRef = db.doc(`applications/${applicationId}`);
        const appSnap = await tx.get(appRef);
        if (!appSnap.exists)
            throw new https_1.HttpsError("not-found", "Application not found.");
        const application = appSnap.data();
        if (!application.committeeDecision)
            return;
        tx.update(appRef, { "committeeDecision.locked": false, updatedAt: firestore_1.FieldValue.serverTimestamp() });
        writeAudit(tx, actor, "application.reopen", "application", applicationId);
    });
    return { ok: true };
});
/**
 * Server-authoritative submission. Enforces cohort open + deadline + ownership
 * + completeness before flipping the application to `submitted`, so a crafted
 * client write can't submit past the deadline.
 */
exports.submitApplication = (0, https_1.onCall)(async (req) => {
    const { applicationId } = (req.data ?? {});
    if (typeof applicationId !== "string" || !applicationId) {
        throw new https_1.HttpsError("invalid-argument", "applicationId is required.");
    }
    const actor = await requireApprovedUser(req, ["founder"]);
    await db.runTransaction(async (tx) => {
        const appRef = db.doc(`applications/${applicationId}`);
        const appSnap = await tx.get(appRef);
        if (!appSnap.exists)
            throw new https_1.HttpsError("not-found", "Application not found.");
        const application = appSnap.data();
        if (application.founderId !== actor.uid) {
            throw new https_1.HttpsError("permission-denied", "Not your application.");
        }
        if (application.status !== "draft") {
            throw new https_1.HttpsError("failed-precondition", "Application is not a draft.");
        }
        const cohortSnap = await tx.get(db.doc(`cohorts/${application.cohortId}`));
        if (!cohortSnap.exists)
            throw new https_1.HttpsError("not-found", "Cohort not found.");
        const cohort = cohortSnap.data();
        if (cohort.status !== "open") {
            throw new https_1.HttpsError("failed-precondition", "This cohort is not open for applications.");
        }
        if (cohort.applicationCloseAt.toMillis() < Date.now()) {
            throw new https_1.HttpsError("failed-precondition", "The application deadline has passed.");
        }
        const complete = application.pitchSummary.trim().length > 0 && (application.documentUrls[0]?.trim().length ?? 0) > 0;
        if (!complete) {
            throw new https_1.HttpsError("failed-precondition", "Complete the pitch summary and deck link first.");
        }
        tx.update(appRef, {
            status: "submitted",
            isComplete: true,
            submittedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        writeAudit(tx, actor, "application.submit", "application", applicationId);
    });
    return { ok: true };
});
