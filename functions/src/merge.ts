import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

/**
 * mergeIdentities (IDM-02 / NFR-09) — admin-only, Admin SDK. Reassigns every
 * reference from a loser identity to a survivor, then TOMBSTONES the loser
 * (never hard-deletes — the audit + tombstone keep the merge recoverable).
 *
 * The reassignment maps below are the single source of truth for which fields
 * point at a person (uid) or an organisation (startupId). The emulator test
 * asserts each field-based collection is rewritten. Singleton docs keyed BY the
 * identity id (opsConfig/opsSummary/graduations/startupInvestorProfiles for an
 * org; investors/adopters for a person) are tombstoned on the loser and left for
 * admin reconciliation — flagged as a known limitation rather than silently
 * moved, since two singletons can't be blindly combined.
 */

const db = () => getFirestore();

type Role = "admin" | "cohort_manager" | "evaluator" | "founder" | "investor" | "probasi_adopter";

// [collection, field] — scalar fields whose value == the identity id.
const PERSON_EQ: [string, string][] = [
  ["startups", "founderId"],
  ["applications", "founderId"],
  ["crmContacts", "founderId"], ["crmContacts", "contributedByUid"],
  ["crmOpportunities", "founderId"],
  ["financeEntries", "founderId"],
  ["campaigns", "founderId"],
  ["opsConfig", "founderId"], ["opsSummary", "founderId"],
  ["consents", "founderId"],
  ["ipCases", "founderId"],
  ["ndaAgreements", "founderId"], ["ndaAgreements", "signerUid"],
  ["documents", "uploadedBy"],
  ["tickets", "requesterId"], ["tickets", "providerId"],
  ["meetings", "requesterId"], ["meetings", "hostId"],
  ["communications", "sentBy"], ["communications", "toUserId"],
  ["enrollments", "founderId"],
  ["graduations", "founderId"],
  ["startupInvestorProfiles", "founderId"],
  ["dataRoomRequests", "investorUid"], ["dataRoomRequests", "founderId"],
  ["dataRoomAccessLog", "investorUid"], ["dataRoomAccessLog", "founderId"],
  ["dealEntries", "investorUid"], ["dealEntries", "founderId"],
  ["adoptionRequests", "adopterUid"], ["adoptionRequests", "founderId"],
  ["adoptionWorkspaces", "adopterUid"], ["adoptionWorkspaces", "founderId"],
  ["aiUsage", "uid"],
];
// [collection, field] — array fields that may contain the identity id.
const PERSON_ARRAY: [string, string][] = [
  ["startups", "teamMemberUids"],
  ["applications", "evaluatorIds"],
  ["documents", "visibleTo"],
  ["pitchEvents", "investorUids"], ["pitchEvents", "shortlistFounderIds"],
];

const ORG_EQ: [string, string][] = [
  ["applications", "startupId"],
  ["crmContacts", "startupId"],
  ["crmOpportunities", "startupId"],
  ["financeEntries", "startupId"],
  ["campaigns", "startupId"],
  ["ipCases", "startupId"],
  ["consents", "startupId"],
  ["dataRoomRequests", "startupId"],
  ["dataRoomAccessLog", "startupId"],
  ["dealEntries", "startupId"],
  ["adoptionRequests", "startupId"],
  ["adoptionWorkspaces", "startupId"],
  ["enrollments", "startupId"],
  ["tickets", "startupId"],
  ["meetings", "startupId"],
  ["aiUsage", "startupId"],
];
const ORG_ARRAY: [string, string][] = [];

async function requireAdmin(req: CallableRequest): Promise<{ uid: string; role: Role }> {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await db().doc(`users/${req.auth.uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "No user profile.");
  const u = snap.data() as { role: Role; approvalStatus: string };
  if (u.approvalStatus !== "approved" || u.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin only.");
  }
  return { uid: req.auth.uid, role: u.role };
}

export const mergeIdentities = onCall(async (req) => {
  const { recordType, survivorId, loserId } = (req.data ?? {}) as {
    recordType?: "users" | "startups"; survivorId?: string; loserId?: string;
  };
  if (recordType !== "users" && recordType !== "startups") {
    throw new HttpsError("invalid-argument", "recordType must be users or startups.");
  }
  if (typeof survivorId !== "string" || typeof loserId !== "string" || !survivorId || !loserId || survivorId === loserId) {
    throw new HttpsError("invalid-argument", "Distinct survivorId and loserId are required.");
  }
  const actor = await requireAdmin(req);

  const survivorRef = db().doc(`${recordType}/${survivorId}`);
  const loserRef = db().doc(`${recordType}/${loserId}`);
  const [sSnap, lSnap] = await Promise.all([survivorRef.get(), loserRef.get()]);
  if (!sSnap.exists || !lSnap.exists) throw new HttpsError("not-found", "Both records must exist.");
  if (lSnap.data()?.mergedInto) throw new HttpsError("failed-precondition", "Loser is already merged.");

  const eqMap = recordType === "users" ? PERSON_EQ : ORG_EQ;
  const arrMap = recordType === "users" ? PERSON_ARRAY : ORG_ARRAY;

  const touched: string[] = [];
  let reassigned = 0;
  let batch = db().batch();
  let ops = 0;
  const flush = async () => { if (ops > 0) { await batch.commit(); batch = db().batch(); ops = 0; } };
  const queue = async (ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) => {
    batch.update(ref, data); ops++; reassigned++;
    if (touched.length < 200) touched.push(ref.path);
    if (ops >= 400) await flush();
  };

  // Scalar reassignments.
  for (const [col, field] of eqMap) {
    const snap = await db().collection(col).where(field, "==", loserId).get();
    for (const d of snap.docs) await queue(d.ref, { [field]: survivorId });
  }
  // Array reassignments (read-compute-set to avoid double-transform on one field).
  for (const [col, field] of arrMap) {
    const snap = await db().collection(col).where(field, "array-contains", loserId).get();
    for (const d of snap.docs) {
      const arr = (d.data()[field] as string[]) ?? [];
      const next = Array.from(new Set(arr.filter((x) => x !== loserId).concat(survivorId)));
      await queue(d.ref, { [field]: next });
    }
  }
  await flush();

  // Tombstone the loser (never delete).
  await loserRef.update({
    mergedInto: survivorId,
    ...(recordType === "users" ? { approvalStatus: "rejected", identityStatus: "unverified" } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await survivorRef.update({ mergedFrom: FieldValue.arrayUnion(loserId), updatedAt: FieldValue.serverTimestamp() });

  // Mark any matching candidate merged.
  const candId = `${recordType}__${[survivorId, loserId].sort().join("__")}`;
  await db().doc(`duplicateCandidates/${candId}`).set(
    { status: "merged", reviewedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  // Single tamper-proof audit entry (client can't forge identity.merge — rules block it).
  await db().collection("auditLog").add({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "identity.merge",
    entityType: "identity",
    entityId: survivorId,
    details: { recordType, survivorId, loserId, reassigned, touched },
    timestamp: FieldValue.serverTimestamp(),
  });

  return { ok: true, reassigned };
});
