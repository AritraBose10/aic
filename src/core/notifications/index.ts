import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CommChannel, CommunicationEntityType, Role } from "@/core/types";

/**
 * Notification templates (COM-01) + per-entity communication timeline (COM-02).
 *
 * "Sending" in the pilot means recording a CommunicationEventDoc on the
 * subject's timeline (actual email/SMS dispatch is an integration deferred per
 * the plan). Every workflow stage renders a template and appends an event so
 * each applicant/startup/mentor has a single auditable communication history.
 */

interface Actor {
  uid: string;
  role: Role;
  name: string;
}

/** Fill {{placeholders}} in a template body/subject. Unmatched keys are left blank. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

export async function upsertTemplate(
  actor: Actor,
  key: string,
  input: { channel: CommChannel; subject: string; body: string; active?: boolean },
): Promise<void> {
  // Template id == key so upserts are idempotent and lookups are a direct get.
  await setDoc(
    doc(db, "notificationTemplates", key),
    {
      key,
      channel: input.channel,
      subject: input.subject,
      body: input.body,
      active: input.active ?? true,
      updatedAt: serverTimestamp(),
      createdBy: actor.uid,
    },
    { merge: true },
  );
}

interface RecordCommunicationInput {
  entityType: CommunicationEntityType;
  entityId: string;
  channel: CommChannel;
  subject: string;
  body: string;
  templateKey?: string;
  toUserId?: string;
}

export async function recordCommunication(actor: Actor, input: RecordCommunicationInput): Promise<void> {
  await addDoc(collection(db, "communications"), {
    entityType: input.entityType,
    entityId: input.entityId,
    templateKey: input.templateKey ?? null,
    channel: input.channel,
    subject: input.subject,
    body: input.body,
    toUserId: input.toUserId ?? null,
    sentBy: actor.uid,
    at: serverTimestamp(),
  });
}

/**
 * Convenience: look up an active template by key, render it with `vars`, and
 * append the event to the subject's timeline. No-op if the template is missing
 * or inactive (so a missing template never blocks the underlying workflow).
 */
export async function notifyStage(
  actor: Actor,
  key: string,
  target: { entityType: CommunicationEntityType; entityId: string; toUserId?: string },
  vars: Record<string, string> = {},
): Promise<void> {
  // Template id == key (see upsertTemplate), so this is a direct get.
  const snap = await getDoc(doc(db, "notificationTemplates", key));
  if (!snap.exists()) return;
  const t = snap.data() as {
    channel: CommChannel;
    subject: string;
    body: string;
    active: boolean;
  };
  if (!t.active) return;
  await recordCommunication(actor, {
    entityType: target.entityType,
    entityId: target.entityId,
    channel: t.channel,
    subject: renderTemplate(t.subject, vars),
    body: renderTemplate(t.body, vars),
    templateKey: key,
    toUserId: target.toUserId,
  });
}
