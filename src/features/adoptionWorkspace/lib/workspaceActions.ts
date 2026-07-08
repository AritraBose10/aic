import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { AdoptionImpact, AdoptionWorkspaceDoc, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
  name: string;
}

const isIncumbent = (r: Role) => r === "admin" || r === "cohort_manager" || r === "founder";

/**
 * Update a workspace's goals/commitments/impact. Both the founder and the
 * adopter member may edit. When the FOUNDER edits (an incumbent who can write
 * opsSummary), the startup's adoption impact is re-rolled into the dashboard
 * summary (ABS-08). Adopter edits update the workspace only; the founder's next
 * edit syncs the rollup.
 */
export async function updateWorkspace(
  actor: Actor,
  workspace: AdoptionWorkspaceDoc,
  patch: Partial<{ goals: string; commitments: string; impact: AdoptionImpact }>,
): Promise<void> {
  await updateDoc(doc(db, "adoptionWorkspaces", workspace.id), { ...patch, updatedAt: serverTimestamp() });
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "adoption.workspace.update", entityType: "adoptionWorkspace", entityId: workspace.id, details: patch.impact ? { impact: true } : {} });

  if (isIncumbent(actor.role)) {
    await recomputeAdoptionSummary(workspace.startupId, workspace.founderId, workspace.startupName);
  }
}

/** Sum adoption impact across all of a startup's workspaces into opsSummary (ABS-08). */
async function recomputeAdoptionSummary(startupId: string, founderId: string, startupName: string): Promise<void> {
  const snap = await getDocs(query(collection(db, "adoptionWorkspaces"), where("startupId", "==", startupId)));
  const ws = snap.docs.map((d) => d.data() as AdoptionWorkspaceDoc);
  await setDoc(
    doc(db, "opsSummary", startupId),
    {
      startupId,
      founderId,
      startupName,
      adoptionMentorHours: ws.reduce((s, w) => s + (w.impact?.mentorHours ?? 0), 0),
      adoptionSalesLeads: ws.reduce((s, w) => s + (w.impact?.salesLeads ?? 0), 0),
      adoptionFundsCommittedLakh: ws.reduce((s, w) => s + (w.impact?.fundsCommittedLakh ?? 0), 0),
      adoptionIntroductions: ws.reduce((s, w) => s + (w.impact?.introductions ?? 0), 0),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * ABS-06: a Probasi adopter contributes a sales lead into the startup's CRM with
 * attribution. Reuses the Phase-3 crmContacts `contributedByUid` field — the
 * lead's founderId is the startup's founder, so the FOUNDER sees it (founder
 * approval is implicit in the accepted adoption workspace). Rules require the
 * adopter to have an active workspace for that startup.
 */
export async function contributeAdoptionLead(
  actor: Actor,
  workspace: { startupId: string; founderId: string },
  input: { name: string; email?: string; company?: string },
): Promise<void> {
  await addDoc(collection(db, "crmContacts"), {
    startupId: workspace.startupId,
    founderId: workspace.founderId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    company: input.company?.trim() || null,
    contributedByUid: actor.uid,
    contributedByName: actor.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "crm.lead.create", entityType: "lead", entityId: workspace.startupId, details: { contributedBy: actor.uid, viaAdoption: true } });
}
