import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { Role } from "@/core/types";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: Exclude<Role, "admin">;
  registrationNote?: string;
}

export async function registerUser(input: RegisterInput): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const credential = await createUserWithEmailAndPassword(auth, email, input.password);
  await updateProfile(credential.user, { displayName: input.name });

  await setDoc(doc(db, "users", credential.user.uid), {
    uid: credential.user.uid,
    email,
    name: input.name,
    phone: input.phone ?? null,
    role: input.role,
    approvalStatus: "pending",
    registrationNote: input.registrationNote ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: credential.user.uid,
    actorRole: input.role,
    action: "user.register",
    entityType: "user",
    entityId: credential.user.uid,
    details: { role: input.role },
  });
}

export async function loginUser(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function approveUser(
  targetUid: string,
  approverUid: string,
  approverRole: Role,
): Promise<void> {
  await updateDoc(doc(db, "users", targetUid), {
    approvalStatus: "approved",
    approvedBy: approverUid,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: approverUid,
    actorRole: approverRole,
    action: "user.approve",
    entityType: "user",
    entityId: targetUid,
  });
}

export async function rejectUser(
  targetUid: string,
  approverUid: string,
  approverRole: Role,
  reason: string,
): Promise<void> {
  await updateDoc(doc(db, "users", targetUid), {
    approvalStatus: "rejected",
    rejectionReason: reason,
    approvedBy: approverUid,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: approverUid,
    actorRole: approverRole,
    action: "user.reject",
    entityType: "user",
    entityId: targetUid,
    details: { reason },
  });
}
