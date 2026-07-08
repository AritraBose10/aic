import { addDoc, collection, doc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { PitchEventStatus, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
  name: string;
}

export async function createPitchEvent(
  actor: Actor,
  input: { title: string; description: string; at: Date },
): Promise<string> {
  const ref = await addDoc(collection(db, "pitchEvents"), {
    title: input.title.trim(),
    description: input.description.trim(),
    at: Timestamp.fromDate(input.at),
    status: "draft" satisfies PitchEventStatus,
    investorUids: [],
    shortlistStartupIds: [],
    shortlistFounderIds: [],
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "pitch.event.update", entityType: "pitchEvent", entityId: ref.id, details: { created: true } });
  return ref.id;
}

export async function updatePitchEvent(
  actor: Actor,
  eventId: string,
  patch: Partial<{ status: PitchEventStatus; investorUids: string[]; shortlistStartupIds: string[]; shortlistFounderIds: string[] }>,
): Promise<void> {
  await updateDoc(doc(db, "pitchEvents", eventId), { ...patch, updatedAt: serverTimestamp() });
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "pitch.event.update", entityType: "pitchEvent", entityId: eventId, details: patch });
}

/** An invited verified investor leaves feedback (one doc per investor, keyed by uid). */
export async function submitPitchFeedback(
  actor: Actor,
  eventId: string,
  input: { startupId: string; note: string },
): Promise<void> {
  await setDoc(doc(db, "pitchEvents", eventId, "feedback", actor.uid), {
    investorUid: actor.uid,
    investorName: actor.name,
    startupId: input.startupId,
    note: input.note.trim(),
    at: serverTimestamp(),
  });
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "pitch.event.update", entityType: "pitchEvent", entityId: eventId, details: { feedback: true } });
}
