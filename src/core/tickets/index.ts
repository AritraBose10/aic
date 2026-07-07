import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { Role, TicketKind, TicketStatus, TicketUrgency } from "@/core/types";

/**
 * Shared ticket primitive (Section 4.1). Both service requests (ECO-02) and
 * the helpdesk (SUP-01) are TicketDocs distinguished by `kind`.
 */

interface Actor {
  uid: string;
  role: Role;
  name: string;
}

export interface CreateTicketInput {
  kind: TicketKind;
  title: string;
  category: string;
  urgency: TicketUrgency;
  requiredOutcome: string;
  startupId?: string;
  slaDays?: number;
}

export async function createTicket(actor: Actor, input: CreateTicketInput): Promise<string> {
  const slaDueAt =
    input.slaDays && input.slaDays > 0
      ? Timestamp.fromMillis(Date.now() + input.slaDays * 24 * 60 * 60 * 1000)
      : null;

  const ref = await addDoc(collection(db, "tickets"), {
    kind: input.kind,
    title: input.title.trim(),
    category: input.category,
    urgency: input.urgency,
    requiredOutcome: input.requiredOutcome.trim(),
    requesterId: actor.uid,
    requesterName: actor.name,
    startupId: input.startupId ?? null,
    providerId: null,
    providerName: null,
    slaDueAt,
    status: "open" satisfies TicketStatus,
    notes: [],
    attachments: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "ticket.create",
    entityType: "ticket",
    entityId: ref.id,
    details: { kind: input.kind, category: input.category },
  });
  return ref.id;
}

export async function assignTicket(
  actor: Actor,
  ticketId: string,
  providerId: string,
  providerName: string,
): Promise<void> {
  await updateDoc(doc(db, "tickets", ticketId), {
    providerId,
    providerName,
    status: "assigned" satisfies TicketStatus,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "ticket.update",
    entityType: "ticket",
    entityId: ticketId,
    details: { assignedTo: providerId },
  });
}

export async function setTicketStatus(
  actor: Actor,
  ticketId: string,
  status: TicketStatus,
  completionEvidence?: string,
): Promise<void> {
  await updateDoc(doc(db, "tickets", ticketId), {
    status,
    ...(completionEvidence !== undefined ? { completionEvidence } : {}),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "ticket.update",
    entityType: "ticket",
    entityId: ticketId,
    details: { status },
  });
}

export async function addTicketNote(actor: Actor, ticketId: string, body: string): Promise<void> {
  await updateDoc(doc(db, "tickets", ticketId), {
    notes: arrayUnion({
      authorId: actor.uid,
      authorName: actor.name,
      body: body.trim(),
      at: Timestamp.now(),
    }),
    updatedAt: serverTimestamp(),
  });
}

export async function rateTicket(
  actor: Actor,
  ticketId: string,
  rating: number,
  ratingComment: string,
): Promise<void> {
  await updateDoc(doc(db, "tickets", ticketId), {
    rating,
    ratingComment: ratingComment.trim() || null,
    status: "closed" satisfies TicketStatus,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "ticket.update",
    entityType: "ticket",
    entityId: ticketId,
    details: { rating },
  });
}
