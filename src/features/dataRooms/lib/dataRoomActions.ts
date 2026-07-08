import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import { grantDocumentViewer } from "@/core/documents";
import type { Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
  name: string;
}

/** INV-04: a verified investor requests access to a startup's data room. */
export async function requestDataRoomAccess(
  actor: Actor,
  startup: { startupId: string; founderId: string; startupName: string },
  message: string,
): Promise<void> {
  await addDoc(collection(db, "dataRoomRequests"), {
    startupId: startup.startupId,
    founderId: startup.founderId,
    startupName: startup.startupName,
    investorUid: actor.uid,
    investorName: actor.name,
    message: message.trim(),
    status: "requested",
    createdAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "dataroom.request",
    entityType: "dataRoomRequest",
    entityId: startup.startupId,
    details: { investorUid: actor.uid },
  });
}

/**
 * Founder (or staff) approves/denies. On approval, the investor is granted read
 * access to the startup's investor-facing documents (visibleTo), and an access
 * log entry is written.
 */
export async function decideDataRoomRequest(
  actor: Actor,
  request: { id: string; startupId: string; founderId: string; investorUid: string },
  approve: boolean,
): Promise<void> {
  await updateDoc(doc(db, "dataRoomRequests", request.id), {
    status: approve ? "approved" : "denied",
    decidedBy: actor.uid,
    decidedAt: serverTimestamp(),
  });

  if (approve) {
    const profileSnap = await getDoc(doc(db, "startupInvestorProfiles", request.startupId));
    const docIds = (profileSnap.data()?.documentIds ?? []) as string[];
    for (const docId of docIds) {
      await grantDocumentViewer({ uid: actor.uid, role: actor.role }, docId, request.investorUid).catch(() => {
        // A doc the actor can't grant (e.g. staff-uploaded) is skipped; others still grant.
      });
    }
    await addDoc(collection(db, "dataRoomAccessLog"), {
      startupId: request.startupId,
      founderId: request.founderId,
      investorUid: request.investorUid,
      action: "granted",
      at: serverTimestamp(),
      by: actor.uid,
    });
  }

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "dataroom.decide",
    entityType: "dataRoomRequest",
    entityId: request.id,
    details: { approved: approve },
  });
}

/** Investor logs a view (INV-04 access log) — append-only, own uid only. */
export async function logDataRoomView(
  actor: Actor,
  entry: { startupId: string; founderId: string; docId?: string },
): Promise<void> {
  await addDoc(collection(db, "dataRoomAccessLog"), {
    startupId: entry.startupId,
    founderId: entry.founderId,
    investorUid: actor.uid,
    action: "viewed",
    docId: entry.docId ?? null,
    at: serverTimestamp(),
    by: actor.uid,
  });
}
