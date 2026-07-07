import { doc, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type {
  ApplicationDoc,
  ApplicationStatus,
  CohortDoc,
  Role,
  StartupDoc,
} from "@/core/types";

/** Surface a callable's HttpsError message (or a fallback) as a plain Error. */
function callableError(err: unknown, fallback: string): Error {
  if (err instanceof FirebaseError && err.message) return new Error(err.message);
  return err instanceof Error ? err : new Error(fallback);
}

interface Actor {
  uid: string;
  role: Role;
}

function assertCohortAcceptingApplications(cohort: Pick<CohortDoc, "status" | "applicationCloseAt">) {
  if (cohort.status !== "open") {
    throw new Error("This cohort is not open for applications.");
  }
  if (cohort.applicationCloseAt.toMillis() < Date.now()) {
    throw new Error("The application deadline for this cohort has passed.");
  }
}

/**
 * Returns the id of the founder's application for this cohort, creating a fresh
 * draft if none exists. The doc id is deterministic (`${cohortId}_${uid}`) and
 * the create runs in a transaction, so two concurrent tabs converge on one
 * draft instead of racing to create duplicates.
 */
export async function getOrCreateDraftApplication(
  actor: Actor,
  startup: StartupDoc,
  cohort: CohortDoc,
): Promise<string> {
  assertCohortAcceptingApplications(cohort);

  const applicationId = `${cohort.id}_${actor.uid}`;
  const ref = doc(db, "applications", applicationId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    tx.set(ref, {
      cohortId: cohort.id,
      cohortName: cohort.name,
      founderId: actor.uid,
      startupId: startup.id,
      startupName: startup.name,
      sector: startup.sector,
      district: startup.district,
      stage: startup.stage,
      pitchSummary: "",
      documentUrls: [],
      status: "draft",
      isComplete: false,
      isEligible: null,
      evaluatorIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return applicationId;
}

export interface ApplicationDraftInput {
  pitchSummary: string;
  pitchDeckUrl: string;
}

function isDraftComplete(input: ApplicationDraftInput): boolean {
  return input.pitchSummary.trim().length > 0 && input.pitchDeckUrl.trim().length > 0;
}

export async function saveApplicationDraft(
  applicationId: string,
  input: ApplicationDraftInput,
): Promise<void> {
  await updateDoc(doc(db, "applications", applicationId), {
    pitchSummary: input.pitchSummary,
    documentUrls: input.pitchDeckUrl.trim() ? [input.pitchDeckUrl.trim()] : [],
    isComplete: isDraftComplete(input),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Submits via the server-authoritative `submitApplication` callable, which
 * enforces cohort-open + deadline + ownership + completeness with Admin
 * privileges (the client can no longer flip status to `submitted` directly)
 * and writes the audit entry server-side.
 */
export async function submitApplication(applicationId: string): Promise<void> {
  try {
    await httpsCallable(functions, "submitApplication")({ applicationId });
  } catch (err) {
    throw callableError(err, "Could not submit application.");
  }
}

export async function assignEvaluators(
  applicationId: string,
  actor: Actor,
  evaluatorIds: string[],
): Promise<void> {
  // Transaction so the submitted -> under_review bump is computed from the
  // current server state, not a stale read.
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "applications", applicationId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Application not found");
    const application = snap.data() as ApplicationDoc;
    const nextStatus: ApplicationStatus =
      application.status === "submitted" ? "under_review" : application.status;
    tx.update(ref, { evaluatorIds, status: nextStatus, updatedAt: serverTimestamp() });
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "application.assign_evaluators",
    entityType: "application",
    entityId: applicationId,
    details: { evaluatorIds },
  });
}

export interface ScoreInput {
  conflictOfInterest: boolean;
  score: number | null;
  comments: string;
}

/**
 * Writes the evaluator's own score doc at applications/{id}/scores/{uid}.
 * Keying by uid makes this idempotent and free of the read-modify-write race
 * that a shared array had — concurrent evaluators never clobber each other.
 * Assignment and lock are enforced by Firestore rules; we surface a friendly
 * error if the write is denied.
 */
export async function submitScore(
  applicationId: string,
  actor: Actor,
  input: ScoreInput,
): Promise<void> {
  try {
    await setDoc(doc(db, "applications", applicationId, "scores", actor.uid), {
      evaluatorId: actor.uid,
      score: input.conflictOfInterest ? 0 : (input.score ?? 0),
      comments: input.conflictOfInterest ? "" : input.comments,
      conflictOfInterest: input.conflictOfInterest,
      submittedAt: serverTimestamp(),
    });
  } catch (err) {
    if (err instanceof FirebaseError && err.code === "permission-denied") {
      throw new Error("You can no longer score this application — it may be locked or unassigned.");
    }
    throw err;
  }

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "application.score",
    entityType: "application",
    entityId: applicationId,
    details: { conflictOfInterest: input.conflictOfInterest },
  });
}

export async function setApplicationEligibility(
  applicationId: string,
  actor: Actor,
  isEligible: boolean | null,
): Promise<void> {
  await updateDoc(doc(db, "applications", applicationId), {
    isEligible,
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "application.eligibility",
    entityType: "application",
    entityId: applicationId,
    details: { isEligible },
  });
}

/**
 * Records a committee decision via the server-authoritative `recordDecision`
 * callable. All the invariants that Firestore rules can't express — capacity,
 * eligibility, admin-only unlock, incubation lifecycle, private notes, and an
 * immutable server-authored audit entry — are enforced there with Admin
 * privileges. The client can no longer write committeeDecision directly.
 */
export async function recordCommitteeDecision(
  applicationId: string,
  decision: "selected" | "rejected" | "waitlisted",
  notes: string,
): Promise<void> {
  try {
    await httpsCallable(functions, "recordDecision")({ applicationId, decision, notes });
  } catch (err) {
    throw callableError(err, "Could not record decision.");
  }
}

/** Reopening a locked decision is admin-only — enforced server-side. */
export async function reopenCommitteeDecision(applicationId: string): Promise<void> {
  try {
    await httpsCallable(functions, "reopenDecision")({ applicationId });
  } catch (err) {
    throw callableError(err, "Could not reopen decision.");
  }
}
