import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { CohortStatus, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
}

export interface CohortInput {
  name: string;
  sectorFocus: string[];
  eligibilityRules: string;
  scoringRubric: string;
  capacity: number;
  applicationOpenAt: Date;
  applicationCloseAt: Date;
}

export async function createCohort(actor: Actor, input: CohortInput): Promise<string> {
  const ref = await addDoc(collection(db, "cohorts"), {
    name: input.name,
    sectorFocus: input.sectorFocus,
    eligibilityRules: input.eligibilityRules,
    scoringRubric: input.scoringRubric,
    capacity: input.capacity,
    selectedCount: 0,
    applicationOpenAt: Timestamp.fromDate(input.applicationOpenAt),
    applicationCloseAt: Timestamp.fromDate(input.applicationCloseAt),
    status: "draft" satisfies CohortStatus,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "cohort.create",
    entityType: "cohort",
    entityId: ref.id,
  });

  return ref.id;
}

export async function updateCohort(
  cohortId: string,
  actor: Actor,
  input: CohortInput,
): Promise<void> {
  await updateDoc(doc(db, "cohorts", cohortId), {
    name: input.name,
    sectorFocus: input.sectorFocus,
    eligibilityRules: input.eligibilityRules,
    scoringRubric: input.scoringRubric,
    capacity: input.capacity,
    applicationOpenAt: Timestamp.fromDate(input.applicationOpenAt),
    applicationCloseAt: Timestamp.fromDate(input.applicationCloseAt),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "cohort.update",
    entityType: "cohort",
    entityId: cohortId,
  });
}

export async function setCohortStatus(
  cohortId: string,
  actor: Actor,
  status: CohortStatus,
): Promise<void> {
  await updateDoc(doc(db, "cohorts", cohortId), {
    status,
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "cohort.update",
    entityType: "cohort",
    entityId: cohortId,
    details: { status },
  });
}
