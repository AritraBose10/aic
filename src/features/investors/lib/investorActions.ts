import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { InvestorEngagement, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
}

export interface InvestorProfileInput {
  name: string;
  sectors: string[];
  ticketMinLakh: number;
  ticketMaxLakh: number;
  geographies: string[];
  stagePreferences: string[];
  portfolio: string;
  languages: string[];
  engagement: InvestorEngagement;
}

/**
 * An investor creates/updates their OWN profile (id == uid). Admin separately
 * verifies the person's identity (identityStatus) — INV-01. Rules restrict this
 * to role==investor writing their own doc.
 */
export async function saveInvestorProfile(actor: Actor, input: InvestorProfileInput): Promise<void> {
  await setDoc(
    doc(db, "investors", actor.uid),
    {
      uid: actor.uid,
      name: input.name.trim(),
      sectors: input.sectors,
      ticketMinLakh: input.ticketMinLakh,
      ticketMaxLakh: input.ticketMaxLakh,
      geographies: input.geographies,
      stagePreferences: input.stagePreferences,
      portfolio: input.portfolio.trim(),
      languages: input.languages,
      engagement: input.engagement,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "investor.profile.update",
    entityType: "investorProfile",
    entityId: actor.uid,
  });
}
