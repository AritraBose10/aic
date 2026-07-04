import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type {
  ApplicationDoc,
  ApplicationStatus,
  CohortDoc,
  Role,
  StartupDoc,
} from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
}

/**
 * Returns the id of the founder's existing application for this cohort, or
 * creates a fresh draft snapshotting the startup profile as it stands now.
 */
export async function getOrCreateDraftApplication(
  actor: Actor,
  startup: StartupDoc,
  cohort: CohortDoc,
): Promise<string> {
  const existing = await getDocs(
    query(
      collection(db, "applications"),
      where("founderId", "==", actor.uid),
      where("cohortId", "==", cohort.id),
      limit(1),
    ),
  );
  if (!existing.empty) return existing.docs[0].id;

  const ref = await addDoc(collection(db, "applications"), {
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

  return ref.id;
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

export async function submitApplication(applicationId: string, actor: Actor): Promise<void> {
  const snap = await getDoc(doc(db, "applications", applicationId));
  if (!snap.exists()) throw new Error("Application not found");
  const application = snap.data() as ApplicationDoc;

  if (!isDraftComplete({ pitchSummary: application.pitchSummary, pitchDeckUrl: application.documentUrls[0] ?? "" })) {
    throw new Error("Complete the pitch summary and pitch deck link before submitting.");
  }

  await updateDoc(doc(db, "applications", applicationId), {
    status: "submitted",
    isComplete: true,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "application.submit",
    entityType: "application",
    entityId: applicationId,
  });
}

async function loadApplication(applicationId: string): Promise<ApplicationDoc> {
  const snap = await getDoc(doc(db, "applications", applicationId));
  if (!snap.exists()) throw new Error("Application not found");
  return { id: snap.id, ...snap.data() } as ApplicationDoc;
}

export async function assignEvaluators(
  applicationId: string,
  actor: Actor,
  evaluatorIds: string[],
): Promise<void> {
  const application = await loadApplication(applicationId);
  const nextStatus: ApplicationStatus =
    application.status === "submitted" ? "under_review" : application.status;

  await updateDoc(doc(db, "applications", applicationId), {
    evaluatorIds,
    status: nextStatus,
    updatedAt: serverTimestamp(),
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

export async function recordCommitteeDecision(
  applicationId: string,
  actor: Actor,
  decision: "selected" | "rejected" | "waitlisted",
  notes: string,
): Promise<void> {
  const application = await loadApplication(applicationId);
  const batch = writeBatch(db);

  batch.update(doc(db, "applications", applicationId), {
    status: decision,
    committeeDecision: {
      decision,
      decidedBy: actor.uid,
      decidedAt: serverTimestamp(),
      locked: true,
      notes: notes || null,
    },
    updatedAt: serverTimestamp(),
  });

  // Selecting an application turns the startup into an incubatee and opens its
  // onboarding checklist. Only initialize once — re-deciding after a reopen
  // must not wipe onboarding progress already made.
  if (decision === "selected") {
    const startupSnap = await getDoc(doc(db, "startups", application.startupId));
    if (startupSnap.exists() && !(startupSnap.data() as StartupDoc).incubation) {
      batch.update(doc(db, "startups", application.startupId), {
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
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "application.decide",
    entityType: "application",
    entityId: applicationId,
    details: { decision },
  });
}

/** Admin-only in the UI — Firestore only enforces "staff", not the admin/cohort_manager distinction. */
export async function reopenCommitteeDecision(applicationId: string, actor: Actor): Promise<void> {
  const application = await loadApplication(applicationId);
  if (!application.committeeDecision) return;

  await updateDoc(doc(db, "applications", applicationId), {
    "committeeDecision.locked": false,
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "application.reopen",
    entityType: "application",
    entityId: applicationId,
  });
}
