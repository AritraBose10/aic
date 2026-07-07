import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import { issueGeneratedDocument } from "@/core/documents";
import type { GraduationCriterion, GraduationDecision, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
}

function scoreOf(criteria: GraduationCriterion[]): number {
  if (criteria.length === 0) return 0;
  return Math.round((criteria.filter((c) => c.met).length / criteria.length) * 100);
}

/** Create/update the configurable graduation scorecard (GRD-01). id == startupId. */
export async function saveScorecard(
  actor: Actor,
  startup: { id: string; name: string; cohortId: string; founderId: string },
  criteria: GraduationCriterion[],
): Promise<void> {
  await setDoc(
    doc(db, "graduations", startup.id),
    {
      startupId: startup.id,
      startupName: startup.name,
      cohortId: startup.cohortId,
      founderId: startup.founderId,
      criteria,
      score: scoreOf(criteria),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "graduation.decide",
    entityType: "graduation",
    entityId: startup.id,
    details: { score: scoreOf(criteria) },
  });
}

/**
 * Record the graduation decision. On "graduated", transitions the startup to
 * alumni (preserving incubation + KPI history) and issues a certificate +
 * outcome report into the vault (GRD-02, GRD-03).
 */
export async function decideGraduation(
  actor: Actor,
  startup: { id: string; name: string; cohortId: string; founderId: string },
  decision: GraduationDecision,
): Promise<void> {
  const gradSnap = await getDoc(doc(db, "graduations", startup.id));
  if (!gradSnap.exists()) throw new Error("Build the scorecard before deciding.");

  let certificateDocId: string | undefined;
  let outcomeReportDocId: string | undefined;

  if (decision === "graduated") {
    certificateDocId = await issueGeneratedDocument(actor, {
      ownerType: "startup",
      ownerId: startup.id,
      category: "certificate",
      title: `Graduation certificate — ${startup.name}`,
      visibleTo: [startup.founderId],
    });
    outcomeReportDocId = await issueGeneratedDocument(actor, {
      ownerType: "startup",
      ownerId: startup.id,
      category: "outcome_report",
      title: `Outcome report — ${startup.name}`,
      visibleTo: [startup.founderId],
    });
  }

  const batch = writeBatch(db);
  batch.update(doc(db, "graduations", startup.id), {
    decision,
    decidedBy: actor.uid,
    decidedAt: serverTimestamp(),
    certificateDocId: certificateDocId ?? null,
    outcomeReportDocId: outcomeReportDocId ?? null,
    updatedAt: serverTimestamp(),
  });
  if (decision === "graduated") {
    batch.update(doc(db, "startups", startup.id), {
      alumni: { graduatedAt: serverTimestamp(), cohortId: startup.cohortId },
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "graduation.decide",
    entityType: "graduation",
    entityId: startup.id,
    details: { decision },
  });
}

/** Used by the founder-facing status card if scorecard sharing is later enabled. */
export async function touchGraduation(startupId: string): Promise<void> {
  await updateDoc(doc(db, "graduations", startupId), { updatedAt: serverTimestamp() });
}
