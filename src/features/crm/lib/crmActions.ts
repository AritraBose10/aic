import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import { grantConsent } from "@/core/consent";
import type { CrmOpportunityDoc, OpsMode, PipelineStage, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
  name: string;
}

/** The startup whose CRM this is (owner). */
interface Owner {
  startupId: string;
  startupName: string;
  founderId: string;
}

// --- contacts / leads (OPS-01, OPS-02) ---

export interface CreateContactInput {
  name: string;
  email?: string;
  company?: string;
  /** Capture outreach consent at lead creation (feeds core/consent). */
  outreachConsent: boolean;
}

export async function createContact(
  actor: Actor,
  owner: Owner,
  input: CreateContactInput,
): Promise<string> {
  const ref = await addDoc(collection(db, "crmContacts"), {
    startupId: owner.startupId,
    founderId: owner.founderId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    company: input.company?.trim() || null,
    // Attribution (OPS-02): who contributed the lead.
    contributedByUid: actor.uid,
    contributedByName: actor.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (input.outreachConsent) {
    await grantConsent(
      { uid: actor.uid, role: actor.role },
      {
        startupId: owner.startupId,
        contactId: ref.id,
        contactEmail: input.email,
        purpose: "outreach",
        source: "crm_contact_form",
      },
    );
  }

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "crm.lead.create",
    entityType: "lead",
    entityId: ref.id,
    details: { startupId: owner.startupId, contributedBy: actor.uid },
  });
  return ref.id;
}

// --- opportunities / pipeline (OPS-01) ---

export async function createOpportunity(
  actor: Actor,
  owner: Owner,
  input: { title: string; value: number; contactId?: string },
): Promise<string> {
  const ref = await addDoc(collection(db, "crmOpportunities"), {
    startupId: owner.startupId,
    founderId: owner.founderId,
    contactId: input.contactId ?? null,
    title: input.title.trim(),
    stage: "lead" satisfies PipelineStage,
    value: input.value,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await recomputeCrmSummary(owner);
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "crm.opportunity.update",
    entityType: "opportunity",
    entityId: ref.id,
    details: { created: true },
  });
  return ref.id;
}

export async function moveOpportunityStage(
  actor: Actor,
  owner: Owner,
  opportunity: CrmOpportunityDoc,
  stage: PipelineStage,
): Promise<void> {
  const closing = stage === "won" || stage === "lost";
  await updateDoc(doc(db, "crmOpportunities", opportunity.id), {
    stage,
    ...(closing ? { closedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
  await recomputeCrmSummary(owner);
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: stage === "won" ? "crm.convert" : "crm.opportunity.update",
    entityType: "opportunity",
    entityId: opportunity.id,
    details: { stage },
  });
}

// --- OPS-07 mode toggle ---

export async function setOpsMode(
  actor: Actor,
  owner: Owner,
  patch: { crmMode?: OpsMode; financeMode?: OpsMode; crmProviderId?: string; financeProviderId?: string },
): Promise<void> {
  await setDoc(
    doc(db, "opsConfig", owner.startupId),
    {
      startupId: owner.startupId,
      founderId: owner.founderId,
      ...patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Recompute the CRM slice of the startup's opsSummary rollup (OPS-06). Firestore
 * can't aggregate server-side, so we recompute from the current opportunities
 * and merge only the CRM-owned fields — finance owns its own fields on the same
 * doc. Staff dashboards read this rollup, never the raw CRM rows.
 */
async function recomputeCrmSummary(owner: Owner): Promise<void> {
  const snap = await getDocs(
    query(collection(db, "crmOpportunities"), where("startupId", "==", owner.startupId)),
  );
  const opps = snap.docs.map((d) => d.data() as CrmOpportunityDoc);
  const open = opps.filter((o) => o.stage !== "won" && o.stage !== "lost");
  const won = opps.filter((o) => o.stage === "won");
  await setDoc(
    doc(db, "opsSummary", owner.startupId),
    {
      startupId: owner.startupId,
      founderId: owner.founderId,
      startupName: owner.startupName,
      pipelineValue: open.reduce((s, o) => s + (o.value || 0), 0),
      openOpportunities: open.length,
      wonOpportunities: won.length,
      wonValue: won.reduce((s, o) => s + (o.value || 0), 0),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
