import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
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

// ============================================================================
// NDA extension (IP-04) — template selection + signed record + unlock link.
// This is SEPARATE from the visibleTo restriction (IP-05): issuing/signing an
// NDA doesn't change access; only granting it adds the signer to the target
// document's visibleTo.
// ============================================================================

interface NdaActor {
  uid: string;
  role: Role;
}

/** Issue an NDA that gates a specific document, pending the signer's signature. */
export async function issueNda(
  actor: NdaActor,
  input: {
    startupId: string;
    founderId: string;
    templateKey: string;
    signerUid: string;
    signerName: string;
    unlocksDocId: string;
  },
): Promise<string> {
  const ref_ = await addDoc(collection(db, "ndaAgreements"), {
    startupId: input.startupId,
    founderId: input.founderId,
    templateKey: input.templateKey,
    signerUid: input.signerUid,
    signerName: input.signerName,
    unlocksDocId: input.unlocksDocId,
    status: "pending",
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "nda.issue",
    entityType: "ndaAgreement",
    entityId: ref_.id,
    details: { unlocksDocId: input.unlocksDocId, signerUid: input.signerUid },
  });
  return ref_.id;
}

/**
 * The signer records their signature. Stores a signed-copy vault record
 * (metadata-only by default; pass a File to store the actual PDF when Storage
 * is enabled). Does NOT grant access yet — the document owner/staff grants.
 */
export async function signNda(
  actor: NdaActor,
  agreement: { id: string; startupId: string; founderId: string; signerUid: string; templateKey: string },
  signedFile?: File,
): Promise<void> {
  let signedDocId: string;
  if (signedFile) {
    signedDocId = await uploadDocument(actor, {
      ownerType: "startup",
      ownerId: agreement.startupId,
      category: "nda_signed",
      title: `Signed NDA (${agreement.templateKey})`,
      file: signedFile,
      visibleTo: [agreement.founderId, agreement.signerUid],
    });
  } else {
    signedDocId = await issueGeneratedDocument(actor, {
      ownerType: "startup",
      ownerId: agreement.startupId,
      category: "nda_signed",
      title: `Signed NDA (${agreement.templateKey})`,
      visibleTo: [agreement.founderId, agreement.signerUid],
    });
  }
  await updateDoc(doc(db, "ndaAgreements", agreement.id), {
    status: "signed",
    signedDocId,
    signedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "nda.sign",
    entityType: "ndaAgreement",
    entityId: agreement.id,
    details: { signedDocId },
  });
}

/**
 * Grant the access the NDA unlocks: adds the signer to the gated document's
 * visibleTo. Must be run by the document owner or staff (documents rules), which
 * is why unlocking is a distinct step from the signer's sign action.
 */
export async function grantNdaAccess(
  actor: NdaActor,
  agreement: { id: string; signerUid: string; unlocksDocId: string },
): Promise<void> {
  // Confirm the target document exists before granting.
  const target = await getDoc(doc(db, "documents", agreement.unlocksDocId));
  if (!target.exists()) throw new Error("The document this NDA unlocks no longer exists.");

  await updateDoc(doc(db, "documents", agreement.unlocksDocId), {
    visibleTo: arrayUnion(agreement.signerUid),
  });
  await updateDoc(doc(db, "ndaAgreements", agreement.id), {
    status: "granted",
    grantedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "nda.sign",
    entityType: "ndaAgreement",
    entityId: agreement.id,
    details: { granted: true, unlocksDocId: agreement.unlocksDocId },
  });
}

/**
 * Grant a viewer read access to a document by adding their uid to visibleTo —
 * the same visibleTo mechanism the NDA flow uses (IP-04/IP-05). Reused by
 * investor data rooms (INV-04) and adoption workspaces (ABS-05). Must be run by
 * the document owner/uploader or staff (documents rules), so a requester can't
 * self-grant.
 */
export async function grantDocumentViewer(
  actor: NdaActor,
  docId: string,
  viewerUid: string,
): Promise<void> {
  const target = await getDoc(doc(db, "documents", docId));
  if (!target.exists()) throw new Error("Document no longer exists.");
  await updateDoc(doc(db, "documents", docId), { visibleTo: arrayUnion(viewerUid) });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "dataroom.access",
    entityType: "document",
    entityId: docId,
    details: { granted: viewerUid },
  });
}
