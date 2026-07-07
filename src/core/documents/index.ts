import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { DocumentOwnerType, Role } from "@/core/types";

/**
 * Secure document vault (DOC-01): categories, versioning, expiry, and a
 * per-document access list. File bytes live in Firebase Storage; metadata +
 * access control live in Firestore (which is RBAC-governed). e-sign is deferred
 * per the plan — this is manual upload/approve.
 */

interface Actor {
  uid: string;
  role: Role;
}

export interface UploadDocumentInput {
  ownerType: DocumentOwnerType;
  ownerId: string;
  category: string;
  title: string;
  file: File;
  expiresAt?: Date;
  visibleTo?: string[];
}

function storagePathFor(input: UploadDocumentInput): string {
  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
  return `documents/${input.ownerType}/${input.ownerId}/${Timestamp.now().toMillis()}_${safeName}`;
}

export async function uploadDocument(actor: Actor, input: UploadDocumentInput): Promise<string> {
  const path = storagePathFor(input);
  const snap = await uploadBytes(ref(storage, path), input.file, {
    customMetadata: { uploadedBy: actor.uid },
  });
  const downloadUrl = await getDownloadURL(snap.ref);

  const docRef = await addDoc(collection(db, "documents"), {
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    category: input.category,
    title: input.title.trim(),
    version: 1,
    storagePath: path,
    downloadUrl,
    uploadedBy: actor.uid,
    expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
    visibleTo: input.visibleTo ?? [],
    supersededBy: null,
    createdAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "document.upload",
    entityType: "document",
    entityId: docRef.id,
    details: { ownerType: input.ownerType, ownerId: input.ownerId, category: input.category },
  });
  return docRef.id;
}

/**
 * Upload a new version: creates a fresh document at version n+1 and marks the
 * previous one superseded (both are retained — the vault is append-only).
 */
export async function uploadNewVersion(
  actor: Actor,
  previous: { id: string; version: number; ownerType: DocumentOwnerType; ownerId: string; category: string; title: string; visibleTo: string[] },
  file: File,
): Promise<string> {
  const input: UploadDocumentInput = {
    ownerType: previous.ownerType,
    ownerId: previous.ownerId,
    category: previous.category,
    title: previous.title,
    file,
    visibleTo: previous.visibleTo,
  };
  const path = storagePathFor(input);
  const snap = await uploadBytes(ref(storage, path), file, {
    customMetadata: { uploadedBy: actor.uid },
  });
  const downloadUrl = await getDownloadURL(snap.ref);

  const docRef = await addDoc(collection(db, "documents"), {
    ownerType: previous.ownerType,
    ownerId: previous.ownerId,
    category: previous.category,
    title: previous.title,
    version: previous.version + 1,
    storagePath: path,
    downloadUrl,
    uploadedBy: actor.uid,
    expiresAt: null,
    visibleTo: previous.visibleTo,
    supersededBy: null,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "documents", previous.id), { supersededBy: docRef.id });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "document.upload",
    entityType: "document",
    entityId: docRef.id,
    details: { version: previous.version + 1, supersedes: previous.id },
  });
  return docRef.id;
}

export async function setDocumentVisibility(
  docId: string,
  visibleTo: string[],
): Promise<void> {
  await updateDoc(doc(db, "documents", docId), { visibleTo });
}

/**
 * Register a system-generated document (e.g. a training certificate or outcome
 * report) as a vault record without a Storage upload. `downloadUrl` may be a
 * generated artifact URL or left blank for a render-on-demand certificate.
 */
export async function issueGeneratedDocument(
  actor: Actor,
  input: {
    ownerType: DocumentOwnerType;
    ownerId: string;
    category: string;
    title: string;
    downloadUrl?: string;
    visibleTo: string[];
  },
): Promise<string> {
  const docRef = await addDoc(collection(db, "documents"), {
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    category: input.category,
    title: input.title.trim(),
    version: 1,
    storagePath: "",
    downloadUrl: input.downloadUrl ?? "",
    uploadedBy: actor.uid,
    expiresAt: null,
    visibleTo: input.visibleTo,
    supersededBy: null,
    createdAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "document.upload",
    entityType: "document",
    entityId: docRef.id,
    details: { generated: true, category: input.category },
  });
  return docRef.id;
}
