import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { ConsentPurpose, Role } from "@/core/types";

/**
 * Contact-level consent store (AIO-04). Distinct from Phase 1's registration
 * consent — this tracks, per CRM contact/lead and per purpose, whether we may
 * contact them, and is revocable. `core/ai` filters non-consented contacts out
 * *before* building any prompt; `features/outreach` blocks sends to them.
 */

interface Actor {
  uid: string;
  role: Role;
}

export function consentDocId(contactId: string, purpose: ConsentPurpose): string {
  return `${contactId}_${purpose}`;
}

interface SetConsentInput {
  startupId: string;
  contactId: string;
  contactEmail?: string;
  purpose: ConsentPurpose;
  source: string;
}

export async function grantConsent(actor: Actor, input: SetConsentInput): Promise<void> {
  const id = consentDocId(input.contactId, input.purpose);
  await setDoc(
    doc(db, "consents", id),
    {
      startupId: input.startupId,
      founderId: actor.uid,
      contactId: input.contactId,
      contactEmail: input.contactEmail ?? null,
      purpose: input.purpose,
      granted: true,
      source: input.source,
      grantedAt: serverTimestamp(),
      revokedAt: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "consent.grant",
    entityType: "consent",
    entityId: id,
    details: { contactId: input.contactId, purpose: input.purpose },
  });
}

export async function revokeConsent(
  actor: Actor,
  contactId: string,
  purpose: ConsentPurpose,
): Promise<void> {
  const id = consentDocId(contactId, purpose);
  await setDoc(
    doc(db, "consents", id),
    { granted: false, revokedAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "consent.revoke",
    entityType: "consent",
    entityId: id,
    details: { contactId, purpose },
  });
}

/**
 * Client-side consent check. `core/ai` re-checks the same docs server-side via
 * the Admin SDK before a prompt is built — this is the convenience/UI mirror.
 */
export async function canContact(contactId: string, purpose: ConsentPurpose): Promise<boolean> {
  const snap = await getDoc(doc(db, "consents", consentDocId(contactId, purpose)));
  return snap.exists() && snap.data().granted === true;
}
