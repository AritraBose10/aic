import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type {
  OnboardingChecklist,
  Role,
  StartupDoc,
  StartupTeamAccessRole,
  StartupTeamMemberDoc,
} from "@/core/types";

export interface StartupProfileInput {
  name: string;
  sector: string;
  district: string;
  stage: string;
  description: string;
}

interface Actor {
  uid: string;
  role: Role;
}

export async function createStartup(actor: Actor, input: StartupProfileInput): Promise<string> {
  // A founder owns at most one startup in Phase 1. Guard here so a double
  // submit (or a second tab) can't strand a duplicate the UI would ignore.
  const existing = await getDocs(
    query(collection(db, "startups"), where("founderId", "==", actor.uid), limit(1)),
  );
  if (!existing.empty) {
    throw new Error("You already have a startup profile.");
  }

  const ref = await addDoc(collection(db, "startups"), {
    founderId: actor.uid,
    ...input,
    teamMembers: [],
    teamMemberUids: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "startup.create",
    entityType: "startup",
    entityId: ref.id,
  });

  return ref.id;
}

export async function updateStartupProfile(
  startupId: string,
  actor: Actor,
  input: StartupProfileInput,
): Promise<void> {
  await updateDoc(doc(db, "startups", startupId), {
    ...input,
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "startup.update",
    entityType: "startup",
    entityId: startupId,
  });
}

function activeUids(teamMembers: StartupTeamMemberDoc[]): string[] {
  return teamMembers.filter((m) => m.status === "active").map((m) => m.uid);
}

export async function inviteTeamMember(
  startupId: string,
  actor: Actor,
  email: string,
  accessRole: StartupTeamAccessRole,
): Promise<void> {
  const usersSnap = await getDocs(
    query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()), limit(1)),
  );
  if (usersSnap.empty) {
    throw new Error("No registered user found with that email — they need to register first.");
  }
  const target = usersSnap.docs[0].data();
  if (target.approvalStatus !== "approved") {
    throw new Error("That user's account is not yet approved.");
  }

  const newMember: StartupTeamMemberDoc = {
    uid: target.uid,
    email: target.email,
    name: target.name,
    accessRole,
    status: "active",
    invitedAt: Timestamp.now(),
  };

  // Transaction: re-read teamMembers inside the tx and append, so two
  // concurrent invites (or an invite racing a suspend) can't clobber each
  // other's array. The user lookup above stays outside — it's not contended.
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "startups", startupId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Startup not found");
    const startup = snap.data() as StartupDoc;
    if (startup.teamMembers.some((m) => m.uid === target.uid)) {
      throw new Error("That person is already on the team.");
    }
    const teamMembers = [...startup.teamMembers, newMember];
    tx.update(ref, {
      teamMembers,
      teamMemberUids: activeUids(teamMembers),
      updatedAt: serverTimestamp(),
    });
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "startup.team.invite",
    entityType: "startup",
    entityId: startupId,
    details: { invitedUid: target.uid, accessRole },
  });
}

async function setTeamMemberStatus(
  startupId: string,
  actor: Actor,
  targetUid: string,
  status: StartupTeamMemberDoc["status"],
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "startups", startupId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Startup not found");
    const startup = snap.data() as StartupDoc;
    const teamMembers = startup.teamMembers.map((m) =>
      m.uid === targetUid ? { ...m, status } : m,
    );
    tx.update(ref, {
      teamMembers,
      teamMemberUids: activeUids(teamMembers),
      updatedAt: serverTimestamp(),
    });
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: status === "active" ? "startup.team.reactivate" : "startup.team.suspend",
    entityType: "startup",
    entityId: startupId,
    details: { targetUid },
  });
}

export function suspendTeamMember(startupId: string, actor: Actor, targetUid: string) {
  return setTeamMemberStatus(startupId, actor, targetUid, "suspended");
}

export function reactivateTeamMember(startupId: string, actor: Actor, targetUid: string) {
  return setTeamMemberStatus(startupId, actor, targetUid, "active");
}

// --- onboarding & KPIs (post-selection) ---

export async function setOnboardingItem(
  startupId: string,
  actor: Actor,
  key: keyof OnboardingChecklist,
  value: boolean,
): Promise<void> {
  await updateDoc(doc(db, "startups", startupId), {
    [`incubation.onboarding.${key}`]: value,
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "startup.onboard.update",
    entityType: "startup",
    entityId: startupId,
    details: { key, value },
  });
}

export interface BaselineKpiInput {
  revenueBand: string;
  customers: number;
  teamSize: number;
  fundsRaised: number;
  notes?: string;
}

/**
 * Writes an append-only baseline snapshot to the kpiSnapshots subcollection
 * and flips the onboarding flag. Snapshots are never edited once written
 * (enforced by Firestore rules), so this is safe to call only once per period.
 */
export async function captureBaselineKpi(
  startupId: string,
  actor: Actor,
  input: BaselineKpiInput,
): Promise<void> {
  await addDoc(collection(db, "startups", startupId, "kpiSnapshots"), {
    capturedAt: serverTimestamp(),
    revenueBand: input.revenueBand,
    customers: input.customers,
    teamSize: input.teamSize,
    fundsRaised: input.fundsRaised,
    notes: input.notes?.trim() || null,
    isBaseline: true,
  });

  await updateDoc(doc(db, "startups", startupId), {
    "incubation.onboarding.baselineKpiCaptured": true,
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "startup.kpi.snapshot",
    entityType: "startup",
    entityId: startupId,
    details: { isBaseline: true },
  });
}
