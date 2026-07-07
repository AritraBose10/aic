import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { MeetingKind, MeetingStatus, Role } from "@/core/types";

/**
 * Generic booking entity used by mentors (ECO-03) and fab labs (ECO-04):
 * request -> accept/reject -> scheduled -> completed. Investor/pitch meetings
 * reuse this in Phase 4.
 */

interface Actor {
  uid: string;
  role: Role;
  name: string;
}

export interface RequestMeetingInput {
  kind: MeetingKind;
  hostId: string;
  hostName: string;
  topic: string;
  proposedAt: Date;
  startupId?: string;
  resourceId?: string;
  resourceName?: string;
}

export async function requestMeeting(actor: Actor, input: RequestMeetingInput): Promise<string> {
  const ref = await addDoc(collection(db, "meetings"), {
    kind: input.kind,
    requesterId: actor.uid,
    requesterName: actor.name,
    startupId: input.startupId ?? null,
    hostId: input.hostId,
    hostName: input.hostName,
    resourceId: input.resourceId ?? null,
    resourceName: input.resourceName ?? null,
    topic: input.topic.trim(),
    proposedAt: Timestamp.fromDate(input.proposedAt),
    status: "requested" satisfies MeetingStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "meeting.request",
    entityType: "meeting",
    entityId: ref.id,
    details: { kind: input.kind, hostId: input.hostId },
  });
  return ref.id;
}

/** Host accepts (with a confirmed time) or rejects a requested meeting. */
export async function respondToMeeting(
  actor: Actor,
  meetingId: string,
  accept: boolean,
  scheduledAt?: Date,
): Promise<void> {
  await updateDoc(doc(db, "meetings", meetingId), {
    status: (accept ? "scheduled" : "rejected") satisfies MeetingStatus,
    ...(accept && scheduledAt ? { scheduledAt: Timestamp.fromDate(scheduledAt) } : {}),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "meeting.respond",
    entityType: "meeting",
    entityId: meetingId,
    details: { accepted: accept },
  });
}

export interface CompleteMeetingInput {
  notes: string;
  actionItems?: string;
  followUpTasks?: string;
  durationMinutes: number;
}

export async function completeMeeting(
  actor: Actor,
  meetingId: string,
  input: CompleteMeetingInput,
): Promise<void> {
  await updateDoc(doc(db, "meetings", meetingId), {
    status: "completed" satisfies MeetingStatus,
    notes: input.notes.trim(),
    actionItems: input.actionItems?.trim() ?? null,
    followUpTasks: input.followUpTasks?.trim() ?? null,
    durationMinutes: input.durationMinutes,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "meeting.complete",
    entityType: "meeting",
    entityId: meetingId,
    details: { durationMinutes: input.durationMinutes },
  });
}

export async function rateMeeting(
  actor: Actor,
  meetingId: string,
  rating: number,
): Promise<void> {
  await updateDoc(doc(db, "meetings", meetingId), { rating, updatedAt: serverTimestamp() });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "meeting.complete",
    entityType: "meeting",
    entityId: meetingId,
    details: { rating },
  });
}
