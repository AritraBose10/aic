import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { DuplicateSubject, Role, StartupDoc, UserDoc } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
}

// --- normalization (deterministic, not fuzzy) ---
export const normName = (s: string) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
export const normPhone = (s: string) => (s ?? "").replace(/\D+/g, "");
export const normDistrict = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function candidateId(recordType: string, a: string, b: string): string {
  return `${recordType}__${[a, b].sort().join("__")}`;
}

/** Emit pairwise candidates for a group of ≥2 records sharing a key. */
async function upsertCandidate(
  subject: DuplicateSubject,
  recordType: "users" | "startups",
  a: { id: string; label: string },
  b: { id: string; label: string },
  matchReason: string,
  matchedOn: string[],
): Promise<boolean> {
  const id = candidateId(recordType, a.id, b.id);
  const existing = await getDoc(doc(db, "duplicateCandidates", id));
  // Don't resurrect a candidate an admin already dismissed or merged.
  if (existing.exists() && existing.data().status !== "open") return false;
  const [idA, idB] = [a.id, b.id].sort();
  const labelA = a.id === idA ? a.label : b.label;
  const labelB = a.id === idA ? b.label : a.label;
  await setDoc(
    doc(db, "duplicateCandidates", id),
    {
      subject, recordType, recordIdA: idA, recordIdB: idB, labelA, labelB,
      matchReason, matchedOn, status: "open", detectedBy: "scan",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return !existing.exists();
}

/**
 * On-demand duplicate scan (IDM-02). Staff-only (reads all users + startups).
 * Persons match on normalized name AND phone; organisations on normalized name
 * AND district. Deterministic candidate ids make re-scans idempotent.
 * (Creation-time flagging would need a Cloud Function trigger — deferred; the
 * scan covers detection without a Blaze dependency.)
 */
export async function runDuplicateScan(actor: Actor): Promise<{ personCandidates: number; orgCandidates: number }> {
  // Persons
  const usersSnap = await getDocs(collection(db, "users"));
  const byPerson = new Map<string, { id: string; label: string }[]>();
  usersSnap.docs.forEach((d) => {
    const u = d.data() as UserDoc;
    if (!u.name || !u.phone) return;
    const key = `${normName(u.name)}|${normPhone(u.phone)}`;
    if (!normName(u.name) || !normPhone(u.phone)) return;
    (byPerson.get(key) ?? byPerson.set(key, []).get(key)!).push({ id: d.id, label: `${u.name} <${u.email}>` });
  });
  let personCandidates = 0;
  for (const group of byPerson.values()) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        if (await upsertCandidate("person", "users", group[i], group[j], "name+phone exact (normalized)", ["name", "phone"])) personCandidates++;
  }

  // Organisations
  const startupsSnap = await getDocs(collection(db, "startups"));
  const byOrg = new Map<string, { id: string; label: string }[]>();
  startupsSnap.docs.forEach((d) => {
    const s = d.data() as StartupDoc;
    if (!s.name) return;
    const key = `${normName(s.name)}|${normDistrict(s.district)}`;
    if (!normName(s.name)) return;
    (byOrg.get(key) ?? byOrg.set(key, []).get(key)!).push({ id: d.id, label: `${s.name} (${s.district})` });
  });
  let orgCandidates = 0;
  for (const group of byOrg.values()) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++)
        if (await upsertCandidate("organisation", "startups", group[i], group[j], "name+district exact (normalized)", ["name", "district"])) orgCandidates++;
  }

  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "duplicate.review", entityType: "duplicateCandidate", entityId: "scan", details: { personCandidates, orgCandidates } });
  return { personCandidates, orgCandidates };
}

export async function dismissCandidate(actor: Actor, candidateId: string): Promise<void> {
  await updateDoc(doc(db, "duplicateCandidates", candidateId), { status: "dismissed", reviewedBy: actor.uid, updatedAt: serverTimestamp() });
  await logAuditEvent({ actorId: actor.uid, actorRole: actor.role, action: "duplicate.review", entityType: "duplicateCandidate", entityId: candidateId, details: { dismissed: true } });
}

/** Thin client wrapper for the Admin-SDK merge (Blaze-gated). */
export async function mergeIdentities(input: { recordType: "users" | "startups"; survivorId: string; loserId: string }): Promise<{ ok: boolean; reassigned: number }> {
  const fn = httpsCallable<typeof input, { ok: boolean; reassigned: number }>(functions, "mergeIdentities");
  return (await fn(input)).data;
}
