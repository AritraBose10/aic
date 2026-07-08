import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
}
interface Owner {
  startupId: string;
  founderId: string;
  startupName: string;
}

export interface StartupInvestorProfileInput {
  pitch: string;
  traction: string;
  team: string;
  financialSummary: string;
  fundingAskLakh: number;
  useOfFunds: string;
  documentIds: string[];
}

/**
 * Founder-side investor-facing profile (INV-02). The founder saves a draft and
 * submits for review; only staff can publish (status transition enforced by
 * rules). id == startupId.
 */
export async function saveStartupInvestorProfile(
  actor: Actor,
  owner: Owner,
  input: StartupInvestorProfileInput,
  submitForReview: boolean,
): Promise<void> {
  await setDoc(
    doc(db, "startupInvestorProfiles", owner.startupId),
    {
      startupId: owner.startupId,
      founderId: owner.founderId,
      startupName: owner.startupName,
      pitch: input.pitch.trim(),
      traction: input.traction.trim(),
      team: input.team.trim(),
      financialSummary: input.financialSummary.trim(),
      fundingAskLakh: input.fundingAskLakh,
      useOfFunds: input.useOfFunds.trim(),
      documentIds: input.documentIds,
      status: submitForReview ? "in_review" : "draft",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "investor.facing_profile.update",
    entityType: "startupInvestorProfile",
    entityId: owner.startupId,
    details: { status: submitForReview ? "in_review" : "draft" },
  });
}

/** Staff review outcome: publish makes it discoverable by verified investors. */
export async function reviewStartupInvestorProfile(
  actor: Actor,
  startupId: string,
  publish: boolean,
): Promise<void> {
  await updateDoc(doc(db, "startupInvestorProfiles", startupId), {
    status: publish ? "published" : "draft",
    reviewedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "investor.facing_profile.review",
    entityType: "startupInvestorProfile",
    entityId: startupId,
    details: { published: publish },
  });
}
