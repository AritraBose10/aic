import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import { createTicket } from "@/core/tickets";
import type { IpCaseType, Role } from "@/core/types";

/**
 * IP support (IP-01, IP-02) is built ON TOP of core/tickets — the ticket drives
 * the case workflow (status/stages, assigned counsel/provider, deadline via SLA,
 * notes, completion evidence). A companion ipCases/{ticketId} doc holds only the
 * IP-specific metadata (type, fee/credit) that doesn't belong on a generic ticket.
 */

interface Actor {
  uid: string;
  role: Role;
  name: string;
}
interface Owner {
  startupId: string;
  founderId: string;
}

export interface OpenIpCaseInput {
  ipType: IpCaseType;
  title: string;
  description: string;
  deadlineDays?: number;
}

export async function openIpCase(actor: Actor, owner: Owner, input: OpenIpCaseInput): Promise<string> {
  // The case workflow is a core/tickets ticket of kind "ip".
  const ticketId = await createTicket(actor, {
    kind: "ip",
    title: input.title,
    category: input.ipType,
    urgency: "medium",
    requiredOutcome: input.description,
    startupId: owner.startupId,
    slaDays: input.deadlineDays,
  });

  await setDoc(doc(db, "ipCases", ticketId), {
    ticketId,
    startupId: owner.startupId,
    founderId: owner.founderId,
    ipType: input.ipType,
    feeCredits: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "ip.case.create",
    entityType: "ipCase",
    entityId: ticketId,
    details: { ipType: input.ipType },
  });
  return ticketId;
}

/** Staff-only fee/credit tracking on an IP case (the ticket handles stages/counsel). */
export async function setIpCaseFeeCredits(actor: Actor, ticketId: string, feeCredits: number): Promise<void> {
  await updateDoc(doc(db, "ipCases", ticketId), { feeCredits, updatedAt: serverTimestamp() });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "ip.case.update",
    entityType: "ipCase",
    entityId: ticketId,
    details: { feeCredits },
  });
}
