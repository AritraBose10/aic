import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AuditAction, AuditEventDoc, Role } from "@/core/types";

interface LogAuditEventInput {
  actorId: string;
  actorRole: Role;
  action: AuditAction;
  entityType: AuditEventDoc["entityType"];
  entityId: string;
  details?: Record<string, unknown>;
}

/**
 * The one function every feature calls to log a meaningful write.
 * Never edit or delete audit events — the log is append-only by convention
 * and by Firestore security rules.
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  await addDoc(collection(db, "auditLog"), {
    ...input,
    timestamp: serverTimestamp(),
  });
}
