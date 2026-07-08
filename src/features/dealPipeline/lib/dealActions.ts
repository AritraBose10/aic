import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { DealStage, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
  name: string;
}

/**
 * INV-06 deal pipeline. INV-07: this records a *status label* only — no
 * financial transaction is ever executed or settled here.
 */
export async function createDealEntry(
  actor: Actor,
  input: { startupId: string; startupName: string; founderId: string },
): Promise<string> {
  const ref = await addDoc(collection(db, "dealEntries"), {
    startupId: input.startupId,
    startupName: input.startupName,
    founderId: input.founderId,
    investorUid: actor.uid,
    investorName: actor.name,
    stage: "interest" satisfies DealStage,
    notes: "",
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "deal.stage.update", entityType: "dealEntry", entityId: ref.id, details: { stage: "interest", created: true } });
  return ref.id;
}

export async function updateDealStage(
  actor: Actor,
  dealId: string,
  stage: DealStage,
  notes?: string,
): Promise<void> {
  await updateDoc(doc(db, "dealEntries", dealId), {
    stage,
    ...(notes !== undefined ? { notes } : {}),
    updatedAt: serverTimestamp(),
  });
  // INV-07: label change only, always audited — never a settlement.
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "deal.stage.update", entityType: "dealEntry", entityId: dealId, details: { stage } });
}
