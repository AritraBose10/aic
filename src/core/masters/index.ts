import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { MasterType, Role } from "@/core/types";

/**
 * Admin-editable taxonomies (ADM-01). Every feature reads its option lists from
 * here via useMasters(type) — nothing hardcodes sectors, categories, or tracks.
 */

interface Actor {
  uid: string;
  role: Role;
}

export const MASTER_TYPE_LABELS: Record<MasterType, string> = {
  sector: "Sectors",
  district: "Districts",
  stage: "Startup stages",
  serviceCategory: "Service categories",
  providerCategory: "Provider categories",
  trainingTrack: "Training tracks",
  documentCategory: "Document categories",
};

export async function createMasterEntry(
  actor: Actor,
  type: MasterType,
  label: string,
  order: number,
): Promise<string> {
  const ref = await addDoc(collection(db, "masters"), {
    type,
    label: label.trim(),
    order,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "master.create",
    entityType: "master",
    entityId: ref.id,
    details: { type, label },
  });
  return ref.id;
}

export async function updateMasterEntry(
  actor: Actor,
  id: string,
  patch: { label?: string; order?: number; active?: boolean },
): Promise<void> {
  await updateDoc(doc(db, "masters", id), {
    ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
    ...(patch.order !== undefined ? { order: patch.order } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "master.update",
    entityType: "master",
    entityId: id,
    details: patch,
  });
}
