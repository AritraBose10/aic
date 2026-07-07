import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DirectoryKind, FabLabEquipment, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
}

export interface DirectoryEntryInput {
  kind: DirectoryKind;
  name: string;
  category: string;
  description: string;
  location?: string;
  languages?: string[];
  contactUserId?: string;
  contactUserName?: string;
  expertise?: string[];
  equipment?: FabLabEquipment[];
  services?: string[];
  sla?: string;
  startupId?: string;
}

export async function createDirectoryEntry(actor: Actor, input: DirectoryEntryInput): Promise<string> {
  const ref = await addDoc(collection(db, "directory"), {
    kind: input.kind,
    name: input.name.trim(),
    category: input.category,
    description: input.description.trim(),
    location: input.location?.trim() ?? null,
    languages: input.languages ?? [],
    contactUserId: input.contactUserId ?? null,
    contactUserName: input.contactUserName ?? null,
    expertise: input.expertise ?? [],
    equipment: input.equipment ?? [],
    services: input.services ?? [],
    sla: input.sla ?? null,
    startupId: input.startupId ?? null,
    active: true,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDirectoryEntry(
  entryId: string,
  patch: Partial<DirectoryEntryInput> & { active?: boolean },
): Promise<void> {
  await updateDoc(doc(db, "directory", entryId), { ...patch, updatedAt: serverTimestamp() });
}
