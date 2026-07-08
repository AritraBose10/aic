import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import { generateOutreachDraft, type OutreachBrief } from "@/core/ai";
import type { CampaignDoc, CampaignOutcome, OutreachChannel, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
}
interface Owner {
  startupId: string;
  startupName: string;
  founderId: string;
}

export async function createCampaign(
  actor: Actor,
  owner: Owner,
  input: { name: string; channel: OutreachChannel; brief: OutreachBrief; contactIds: string[] },
): Promise<string> {
  const ref = await addDoc(collection(db, "campaigns"), {
    startupId: owner.startupId,
    founderId: owner.founderId,
    name: input.name.trim(),
    channel: input.channel,
    brief: input.brief,
    contactIds: input.contactIds,
    status: "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Generate a draft via the server-side core/ai function. The server performs the
 * consent + confidential filtering before building the prompt; we persist which
 * recipients it accepted/rejected so the founder sees the guardrail's effect.
 */
export async function generateCampaignDraft(actor: Actor, campaign: CampaignDoc): Promise<void> {
  const result = await generateOutreachDraft({
    startupId: campaign.startupId,
    channel: campaign.channel,
    brief: campaign.brief,
    contactIds: campaign.contactIds,
  });
  await updateDoc(doc(db, "campaigns", campaign.id), {
    draft: result.draft,
    draftModel: result.model,
    includedContactIds: result.includedContactIds,
    excludedContactIds: result.excludedContactIds,
    // A fresh draft always returns to unapproved.
    status: "draft",
    approvedBy: null,
    approvedAt: null,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "outreach.draft",
    entityType: "campaign",
    entityId: campaign.id,
    details: { included: result.includedContactIds.length, excluded: result.excludedContactIds.length },
  });
}

export async function approveCampaign(actor: Actor, campaign: CampaignDoc): Promise<void> {
  if (!campaign.draft) throw new Error("Generate a draft before approving.");
  await updateDoc(doc(db, "campaigns", campaign.id), {
    status: "approved",
    approvedBy: actor.uid,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "outreach.approve",
    entityType: "campaign",
    entityId: campaign.id,
  });
}

/**
 * AIO-04 guardrail: a campaign can only be "sent" once a human has approved it.
 * An attempt to send an unapproved campaign is blocked AND written to the audit
 * log. (Actual message dispatch is out of Phase 3 scope — "send" records intent
 * and flips status; the guardrail is what matters for the exit test.)
 */
export async function sendCampaign(actor: Actor, campaign: CampaignDoc): Promise<void> {
  if (campaign.status !== "approved") {
    await logAuditEvent({
      actorId: actor.uid,
      actorRole: actor.role,
      action: "outreach.send_blocked",
      entityType: "campaign",
      entityId: campaign.id,
      details: { reason: "not_approved", status: campaign.status },
    });
    throw new Error("Blocked: this campaign has not been approved. Approve it before sending.");
  }
  await updateDoc(doc(db, "campaigns", campaign.id), { status: "sent", updatedAt: serverTimestamp() });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "outreach.outcome",
    entityType: "campaign",
    entityId: campaign.id,
    details: { event: "sent", recipients: campaign.includedContactIds?.length ?? 0 },
  });
}

/** Record outcomes and roll them up to the ops summary the dashboard reads (AIO-05). */
export async function recordCampaignOutcome(
  actor: Actor,
  owner: Owner,
  campaign: CampaignDoc,
  outcome: Omit<CampaignOutcome, "updatedAt">,
): Promise<void> {
  await updateDoc(doc(db, "campaigns", campaign.id), {
    outcome: { ...outcome, updatedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });

  // Roll the outreach outcome into the startup's opsSummary (dashboard-visible).
  const summaryRef = doc(db, "opsSummary", owner.startupId);
  const prev = await getDoc(summaryRef);
  const p = prev.data() as
    | { outreachSent?: number; outreachResponses?: number; outreachConversions?: number; outreachSalesValue?: number }
    | undefined;
  const prevOutcome = campaign.outcome;
  await setDoc(
    summaryRef,
    {
      startupId: owner.startupId,
      founderId: owner.founderId,
      startupName: owner.startupName,
      outreachSent: (p?.outreachSent ?? 0) - (prevOutcome?.sent ?? 0) + outcome.sent,
      outreachResponses: (p?.outreachResponses ?? 0) - (prevOutcome?.responses ?? 0) + outcome.responses,
      outreachConversions: (p?.outreachConversions ?? 0) - (prevOutcome?.conversions ?? 0) + outcome.conversions,
      outreachSalesValue: (p?.outreachSalesValue ?? 0) - (prevOutcome?.salesValue ?? 0) + outcome.salesValue,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "outreach.outcome",
    entityType: "campaign",
    entityId: campaign.id,
    details: { ...outcome },
  });
}
