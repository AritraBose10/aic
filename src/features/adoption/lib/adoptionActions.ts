import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import { grantConsent, consentDocId } from "@/core/consent";
import { ACKNOWLEDGEMENT_PURPOSES, type AdoptionMode, type ConsentPurpose, type Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
  name: string;
}

// --- ABS-01: adopter profile ---
export async function saveAdopterProfile(
  actor: Actor,
  input: { name: string; location: string; sectorExpertise: string[]; languages: string[]; availability: string; contributionModes: AdoptionMode[] },
): Promise<void> {
  await setDoc(
    doc(db, "adopters", actor.uid),
    { uid: actor.uid, ...input, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  );
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "adopter.profile.update", entityType: "adopterProfile", entityId: actor.uid });
}

/**
 * ABS-09 acknowledgements — recorded via core/consent (reused, not a new
 * mechanism). Each ack is a consent doc owned by the acknowledging user.
 */
export async function recordAcknowledgements(actor: Actor): Promise<void> {
  for (const purpose of ACKNOWLEDGEMENT_PURPOSES) {
    await grantConsent(
      { uid: actor.uid, role: actor.role },
      { startupId: actor.uid, contactId: actor.uid, purpose: purpose as ConsentPurpose, source: "adoption_ack" },
    );
  }
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "acknowledge", entityType: "adopterProfile", entityId: actor.uid });
}

/** Client-side gate: have all acknowledgements been recorded? (Rules also require them per-write.) */
export async function hasAllAcknowledgements(uid: string): Promise<boolean> {
  for (const purpose of ACKNOWLEDGEMENT_PURPOSES) {
    const snap = await getDoc(doc(db, "consents", consentDocId(uid, purpose as ConsentPurpose)));
    if (!snap.exists() || snap.data().granted !== true) return false;
  }
  return true;
}

// --- ABS-03/04: adoption requests ---
export async function requestAdoption(
  actor: Actor,
  startup: { startupId: string; founderId: string; startupName: string },
  modes: AdoptionMode[],
  message: string,
): Promise<void> {
  if (!(await hasAllAcknowledgements(actor.uid))) {
    throw new Error("Complete the confidentiality & disclosure acknowledgements first.");
  }
  await addDoc(collection(db, "adoptionRequests"), {
    startupId: startup.startupId,
    founderId: startup.founderId,
    startupName: startup.startupName,
    adopterUid: actor.uid,
    adopterName: actor.name,
    modes,
    message: message.trim(),
    status: "requested",
    createdAt: serverTimestamp(),
  });
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "adoption.request", entityType: "adoptionRequest", entityId: startup.startupId, details: { modes } });
}

/** Founder accepts/declines/negotiates. On accept, opens the workspace (ABS-05). */
export async function decideAdoption(
  actor: Actor,
  request: { id: string; startupId: string; founderId: string; startupName: string; adopterUid: string; adopterName: string; modes: AdoptionMode[] },
  decision: "accepted" | "declined" | "negotiating",
): Promise<void> {
  await updateDoc(doc(db, "adoptionRequests", request.id), { status: decision, decidedAt: serverTimestamp() });

  if (decision === "accepted") {
    await setDoc(doc(db, "adoptionWorkspaces", `${request.startupId}_${request.adopterUid}`), {
      startupId: request.startupId,
      founderId: request.founderId,
      startupName: request.startupName,
      adopterUid: request.adopterUid,
      adopterName: request.adopterName,
      modes: request.modes,
      goals: "",
      commitments: "",
      impact: { mentorHours: 0, salesLeads: 0, meetings: 0, fundsCommittedLakh: 0, introductions: 0, docsReviewed: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "adoption.decide", entityType: "adoptionRequest", entityId: request.id, details: { decision } });
}
