/**
 * Integration tests for the callable Cloud Functions, run against the Firestore
 * emulator via `firebase emulators:exec`. firebase-functions-test wraps each
 * callable so we can invoke it with a server-verified auth context; the
 * function's Admin SDK talks to the emulator (FIRESTORE_EMULATOR_HOST is set by
 * emulators:exec).
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import functionsTestInit from "firebase-functions-test";

const fft = functionsTestInit({ projectId: "demo-aic-techno" });

import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { recordDecision, reopenDecision, submitApplication } from "./index";

const db = getFirestore();

// firebase-functions-test accepts a partial CallableRequest at runtime; the
// published types insist on the full shape, so invoke through a loose type.
type Call = (req: { data: unknown; auth?: { uid: string } }) => Promise<unknown>;
const wrappedDecision = fft.wrap(recordDecision) as unknown as Call;
const wrappedReopen = fft.wrap(reopenDecision) as unknown as Call;
const wrappedSubmit = fft.wrap(submitApplication) as unknown as Call;

const DAY = 24 * 60 * 60 * 1000;

async function wipe() {
  for (const c of ["users", "cohorts", "applications", "startups", "auditLog"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

async function seed() {
  await wipe();
  const now = Timestamp.now();
  await db.doc("users/admin").set({ role: "admin", approvalStatus: "approved" });
  await db.doc("users/mgr").set({ role: "cohort_manager", approvalStatus: "approved" });
  await db.doc("users/evalA").set({ role: "evaluator", approvalStatus: "approved" });
  await db.doc("users/founder").set({ role: "founder", approvalStatus: "approved" });

  await db.doc("cohorts/open").set({
    name: "Open", capacity: 2, selectedCount: 0, status: "open",
    applicationOpenAt: Timestamp.fromMillis(now.toMillis() - DAY),
    applicationCloseAt: Timestamp.fromMillis(now.toMillis() + DAY),
  });
  await db.doc("cohorts/full").set({
    name: "Full", capacity: 1, selectedCount: 1, status: "open",
    applicationOpenAt: Timestamp.fromMillis(now.toMillis() - DAY),
    applicationCloseAt: Timestamp.fromMillis(now.toMillis() + DAY),
  });
  await db.doc("cohorts/closed").set({
    name: "Closed", capacity: 5, selectedCount: 0, status: "open",
    applicationOpenAt: Timestamp.fromMillis(now.toMillis() - 2 * DAY),
    applicationCloseAt: Timestamp.fromMillis(now.toMillis() - DAY), // deadline passed
  });

  await db.doc("startups/s1").set({ founderId: "founder", name: "S1", sector: "AgriTech" });

  const appBase = {
    founderId: "founder", startupId: "s1", startupName: "S1", sector: "AgriTech",
    district: "Kolkata", stage: "MVP", pitchSummary: "pitch", documentUrls: ["https://deck"],
    isComplete: true, isEligible: null, evaluatorIds: ["evalA"], createdAt: now, updatedAt: now,
  };
  await db.doc("applications/app_open").set({ ...appBase, cohortId: "open", cohortName: "Open", status: "under_review" });
  await db.doc("applications/app_inelig").set({ ...appBase, cohortId: "open", cohortName: "Open", status: "under_review", isEligible: false });
  await db.doc("applications/app_full").set({ ...appBase, cohortId: "full", cohortName: "Full", status: "under_review" });
  await db.doc("applications/draft_open").set({ ...appBase, cohortId: "open", cohortName: "Open", status: "draft" });
  await db.doc("applications/draft_closed").set({ ...appBase, cohortId: "closed", cohortName: "Closed", status: "draft" });
  await db.doc("applications/draft_incomplete").set({
    ...appBase, cohortId: "open", cohortName: "Open", status: "draft", pitchSummary: "", documentUrls: [],
  });
}

const asFounder = { auth: { uid: "founder" } };
const asMgr = { auth: { uid: "mgr" } };
const asAdmin = { auth: { uid: "admin" } };
const asEval = { auth: { uid: "evalA" } };

beforeEach(seed);
afterAll(() => fft.cleanup());

describe("recordDecision", () => {
  it("selects an eligible application, opens incubation, bumps the counter, writes audit", async () => {
    await wrappedDecision({ data: { applicationId: "app_open", decision: "selected" }, ...asMgr });

    const app = (await db.doc("applications/app_open").get()).data()!;
    expect(app.status).toBe("selected");
    expect(app.committeeDecision.locked).toBe(true);
    expect(app.committeeDecision.decidedBy).toBeUndefined(); // decider stays private

    const review = (await db.doc("applications/app_open/review/decision").get()).data()!;
    expect(review.decidedBy).toBe("mgr");

    const cohort = (await db.doc("cohorts/open").get()).data()!;
    expect(cohort.selectedCount).toBe(1);

    const startup = (await db.doc("startups/s1").get()).data()!;
    expect(startup.incubation.applicationId).toBe("app_open");

    const audit = await db.collection("auditLog").where("action", "==", "application.decide").get();
    expect(audit.size).toBe(1);
    expect(audit.docs[0].data().actorId).toBe("mgr");
  });

  it("blocks selecting an ineligible application", async () => {
    await expect(
      wrappedDecision({ data: { applicationId: "app_inelig", decision: "selected" }, ...asMgr }),
    ).rejects.toThrow(/ineligible/i);
  });

  it("enforces cohort capacity", async () => {
    await expect(
      wrappedDecision({ data: { applicationId: "app_full", decision: "selected" }, ...asMgr }),
    ).rejects.toThrow(/capacity/i);
  });

  it("rejects an unauthenticated caller", async () => {
    await expect(
      wrappedDecision({ data: { applicationId: "app_open", decision: "selected" } }),
    ).rejects.toThrow();
  });

  it("rejects a non-staff caller (evaluator)", async () => {
    await expect(
      wrappedDecision({ data: { applicationId: "app_open", decision: "selected" }, ...asEval }),
    ).rejects.toThrow(/permission/i);
  });

  it("a cohort_manager canNOT alter a locked decision; an admin can reopen then re-decide, rescinding incubation", async () => {
    await wrappedDecision({ data: { applicationId: "app_open", decision: "selected" }, ...asMgr });
    // locked now — cohort_manager re-decide is denied
    await expect(
      wrappedDecision({ data: { applicationId: "app_open", decision: "rejected" }, ...asMgr }),
    ).rejects.toThrow(/locked/i);
    // admin reopens, then rejects -> counter decrements, incubation rescinded
    await wrappedReopen({ data: { applicationId: "app_open" }, ...asAdmin });
    await wrappedDecision({ data: { applicationId: "app_open", decision: "rejected" }, ...asAdmin });

    expect((await db.doc("cohorts/open").get()).data()!.selectedCount).toBe(0);
    expect((await db.doc("startups/s1").get()).data()!.incubation).toBeUndefined();
  });

  it("reopen is admin-only", async () => {
    await wrappedDecision({ data: { applicationId: "app_open", decision: "selected" }, ...asMgr });
    await expect(
      wrappedReopen({ data: { applicationId: "app_open" }, ...asMgr }),
    ).rejects.toThrow(/permission/i);
  });
});

describe("submitApplication", () => {
  it("submits a complete draft for an open cohort and writes audit", async () => {
    await wrappedSubmit({ data: { applicationId: "draft_open" }, ...asFounder });
    const app = (await db.doc("applications/draft_open").get()).data()!;
    expect(app.status).toBe("submitted");
    const audit = await db.collection("auditLog").where("action", "==", "application.submit").get();
    expect(audit.size).toBe(1);
  });

  it("blocks submitting after the deadline", async () => {
    await expect(
      wrappedSubmit({ data: { applicationId: "draft_closed" }, ...asFounder }),
    ).rejects.toThrow(/deadline|not open/i);
  });

  it("blocks submitting an incomplete draft", async () => {
    await expect(
      wrappedSubmit({ data: { applicationId: "draft_incomplete" }, ...asFounder }),
    ).rejects.toThrow(/complete/i);
  });

  it("blocks submitting someone else's application", async () => {
    await db.doc("users/other").set({ role: "founder", approvalStatus: "approved" });
    await expect(
      wrappedSubmit({ data: { applicationId: "draft_open" }, auth: { uid: "other" } }),
    ).rejects.toThrow(/not your/i);
  });
});

// ===================== core/ai — AIO-04 guardrail =====================

import { generateOutreachDraft } from "./index";
const wrappedOutreach = fft.wrap(generateOutreachDraft) as unknown as Call;

async function seedOutreach() {
  for (const c of ["users", "startups", "crmContacts", "consents", "aiUsage", "documents"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/founder").set({ role: "founder", approvalStatus: "approved" });
  await db.doc("users/intruder").set({ role: "founder", approvalStatus: "approved" });
  await db.doc("startups/s1").set({ founderId: "founder", name: "S1" });
  // cA has consent, cB does not.
  await db.doc("crmContacts/cA").set({ startupId: "s1", founderId: "founder", name: "Consented Co" });
  await db.doc("crmContacts/cB").set({ startupId: "s1", founderId: "founder", name: "NoConsent Co" });
  await db.doc("consents/cA_outreach").set({
    startupId: "s1", founderId: "founder", contactId: "cA", purpose: "outreach", granted: true, source: "test",
  });
}

const brief = { segment: "SMB", valueProp: "We save you time.", goal: "book a demo" };

describe("generateOutreachDraft (AIO-04 consent guardrail)", () => {
  beforeEach(seedOutreach);

  it("filters non-consented contacts OUT before the prompt is built", async () => {
    const res = (await wrappedOutreach({
      data: { startupId: "s1", channel: "email", brief, contactIds: ["cA", "cB"] },
      ...asFounder,
    })) as { includedContactIds: string[]; excludedContactIds: string[]; draft: string };

    expect(res.includedContactIds).toEqual(["cA"]);
    expect(res.excludedContactIds).toEqual(["cB"]);
    expect(res.draft.length).toBeGreaterThan(0);

    // Verifiable, not just asserted: the usage log records exactly which
    // recipients reached the prompt — cB must be absent.
    const usage = await db.collection("aiUsage").where("startupId", "==", "s1").get();
    expect(usage.size).toBe(1);
    const recorded = usage.docs[0].data().recipientContactIds as string[];
    expect(recorded).toEqual(["cA"]);
    expect(recorded).not.toContain("cB");
  });

  it("refuses when NO contact has granted consent", async () => {
    await expect(
      wrappedOutreach({ data: { startupId: "s1", channel: "email", brief, contactIds: ["cB"] }, ...asFounder }),
    ).rejects.toThrow(/consent/i);
    // Nothing was logged because no prompt was built.
    const usage = await db.collection("aiUsage").get();
    expect(usage.size).toBe(0);
  });

  it("rejects a caller who does not own the startup", async () => {
    await expect(
      wrappedOutreach({
        data: { startupId: "s1", channel: "email", brief, contactIds: ["cA"] },
        auth: { uid: "intruder" },
      }),
    ).rejects.toThrow(/not your startup/i);
  });

  it("requires at least one contact", async () => {
    await expect(
      wrappedOutreach({ data: { startupId: "s1", channel: "email", brief, contactIds: [] }, ...asFounder }),
    ).rejects.toThrow(/contact/i);
  });
});

// ===================== core/search — AIS-04 permission filter =====================

import { searchQuery } from "./index";
const wrappedSearch = fft.wrap(searchQuery) as unknown as Call;

async function seedSearch() {
  for (const c of ["users", "startups", "documents", "crmContacts", "applications", "startupInvestorProfiles", "searchIndex", "aiUsage"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/founder").set({ role: "founder", approvalStatus: "approved" });
  await db.doc("users/invV").set({ role: "investor", approvalStatus: "approved", identityStatus: "verified" });
  await db.doc("users/mgr").set({ role: "cohort_manager", approvalStatus: "approved" });

  // All docs mention "acme" so the keyword retriever surfaces them as candidates.
  await db.doc("startups/s1").set({ founderId: "founder", name: "Acme startup", teamMemberUids: [] });
  await db.doc("documents/dSecret").set({ uploadedBy: "founder", visibleTo: ["founder"], title: "Acme secret deck" });
  await db.doc("crmContacts/cSecret").set({ founderId: "founder", name: "Acme lead" });
  await db.doc("applications/aSecret").set({ founderId: "founder", evaluatorIds: [], startupName: "Acme app" });
  await db.doc("startupInvestorProfiles/pubProfile").set({ founderId: "founder", startupName: "Acme (published)", status: "published" });
  await db.doc("startupInvestorProfiles/draftProfile").set({ founderId: "founder", startupName: "Acme (draft)", status: "draft" });

  const idx = (id: string, entityType: string, entityId: string, title: string) =>
    db.doc(`searchIndex/${id}`).set({ entityType, entityId, title, text: "acme agritech kolkata" });
  await Promise.all([
    idx("i_startup", "startup", "s1", "Acme startup"),
    idx("i_doc", "document", "dSecret", "Acme secret deck"),
    idx("i_crm", "crmContact", "cSecret", "Acme lead"),
    idx("i_app", "application", "aSecret", "Acme app"),
    idx("i_pub", "startupInvestorProfile", "pubProfile", "Acme (published)"),
    idx("i_draft", "startupInvestorProfile", "draftProfile", "Acme (draft)"),
  ]);
}

describe("searchQuery (AIS-04 permission-aware retrieval)", () => {
  beforeEach(seedSearch);

  it("an investor gets ONLY the published profile — every restricted type is filtered out", async () => {
    const res = (await wrappedSearch({ data: { query: "acme" }, auth: { uid: "invV" } })) as {
      citations: { sourceId: string; sourceType: string }[]; resultCount: number; filteredOutCount: number;
    };
    const ids = res.citations.map((c) => c.sourceId);
    // Only the published investor-facing profile is visible to a verified investor.
    expect(ids).toEqual(["pubProfile"]);
    expect(res.resultCount).toBe(1);
    // The 5 restricted candidates (startup, doc, crm, application, draft profile) were withheld.
    expect(res.filteredOutCount).toBe(5);
    // Explicit per-type checks: none of the restricted docs leaked.
    for (const restricted of ["s1", "dSecret", "cSecret", "aSecret", "draftProfile"]) {
      expect(ids).not.toContain(restricted);
    }
  });

  it("the usage log records only the permitted source ids (no restricted leak into logs)", async () => {
    await wrappedSearch({ data: { query: "acme" }, auth: { uid: "invV" } });
    const usage = await db.collection("aiUsage").where("feature", "==", "search").get();
    expect(usage.size).toBe(1);
    expect(usage.docs[0].data().retrievedSourceIds).toEqual(["pubProfile"]);
  });

  it("the founder (owner) sees their own restricted records", async () => {
    const res = (await wrappedSearch({ data: { query: "acme" }, auth: { uid: "founder" } })) as {
      citations: { sourceId: string }[];
    };
    const ids = res.citations.map((c) => c.sourceId);
    expect(ids).toContain("s1");
    expect(ids).toContain("dSecret");
    expect(ids).toContain("cSecret");
  });

  it("staff do NOT get founder-private CRM rows via search (OPS-06 preserved)", async () => {
    const res = (await wrappedSearch({ data: { query: "acme" }, auth: { uid: "mgr" } })) as {
      citations: { sourceId: string }[];
    };
    const ids = res.citations.map((c) => c.sourceId);
    expect(ids).not.toContain("cSecret");
    expect(ids).toContain("s1"); // staff can read startups
  });

  it("requires an approved account and a non-empty query", async () => {
    await expect(wrappedSearch({ data: { query: "" }, auth: { uid: "invV" } })).rejects.toThrow(/query/i);
    await expect(wrappedSearch({ data: { query: "acme" } })).rejects.toThrow(/sign in/i);
  });
});

// ===================== mergeIdentities (IDM-02) =====================

import { mergeIdentities } from "./index";
const wrappedMerge = fft.wrap(mergeIdentities) as unknown as Call;

async function seedMerge() {
  for (const c of ["users", "startups", "applications", "crmContacts", "documents", "auditLog", "duplicateCandidates", "dealEntries"]) {
    const snap = await db.collection(c).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/admin").set({ role: "admin", approvalStatus: "approved" });
  await db.doc("users/founderA").set({ role: "founder", approvalStatus: "approved", name: "Ada Founder", phone: "+91 90000 11111" });
  await db.doc("users/founderB").set({ role: "founder", approvalStatus: "approved", name: "Ada Founder", phone: "9000011111" });
  // Loser (founderB)-owned records that must move to survivor (founderA).
  await db.doc("startups/sB").set({ founderId: "founderB", name: "Acme", district: "Kolkata", teamMemberUids: ["founderB"] });
  await db.doc("applications/aB").set({ founderId: "founderB", startupId: "sB", evaluatorIds: [] });
  await db.doc("crmContacts/cB").set({ founderId: "founderB", name: "Lead" });
  await db.doc("documents/dB").set({ uploadedBy: "founderB", visibleTo: ["founderB", "x"] });
}

describe("mergeIdentities (person merge)", () => {
  beforeEach(seedMerge);

  it("reassigns loser-owned records to the survivor, tombstones the loser, writes one audit entry", async () => {
    const res = (await wrappedMerge({
      data: { recordType: "users", survivorId: "founderA", loserId: "founderB" },
      auth: { uid: "admin" },
    })) as { ok: boolean; reassigned: number };
    expect(res.ok).toBe(true);
    expect(res.reassigned).toBeGreaterThanOrEqual(4);

    // Field-based references now point at the survivor.
    expect((await db.doc("startups/sB").get()).data()!.founderId).toBe("founderA");
    expect((await db.doc("applications/aB").get()).data()!.founderId).toBe("founderA");
    expect((await db.doc("crmContacts/cB").get()).data()!.founderId).toBe("founderA");
    expect((await db.doc("documents/dB").get()).data()!.uploadedBy).toBe("founderA");
    // Array membership rewritten (loser removed, survivor present).
    const team = (await db.doc("startups/sB").get()).data()!.teamMemberUids as string[];
    expect(team).toContain("founderA");
    expect(team).not.toContain("founderB");
    const vis = (await db.doc("documents/dB").get()).data()!.visibleTo as string[];
    expect(vis).toContain("founderA");
    expect(vis).not.toContain("founderB");

    // Loser tombstoned, not deleted.
    const loser = (await db.doc("users/founderB").get()).data()!;
    expect(loser.mergedInto).toBe("founderA");
    expect(loser.approvalStatus).toBe("rejected");
    expect((await db.doc("users/founderA").get()).data()!.mergedFrom).toContain("founderB");

    // Exactly one identity.merge audit entry, naming touched docs.
    const audit = await db.collection("auditLog").where("action", "==", "identity.merge").get();
    expect(audit.size).toBe(1);
    expect((audit.docs[0].data().details.touched as string[]).length).toBeGreaterThanOrEqual(4);
  });

  it("rejects non-admins and self-merge", async () => {
    await expect(wrappedMerge({ data: { recordType: "users", survivorId: "founderA", loserId: "founderB" }, auth: { uid: "founderA" } })).rejects.toThrow(/admin/i);
    await expect(wrappedMerge({ data: { recordType: "users", survivorId: "founderA", loserId: "founderA" }, auth: { uid: "admin" } })).rejects.toThrow(/distinct/i);
  });

  it("won't re-merge an already-merged loser", async () => {
    await wrappedMerge({ data: { recordType: "users", survivorId: "founderA", loserId: "founderB" }, auth: { uid: "admin" } });
    await expect(wrappedMerge({ data: { recordType: "users", survivorId: "founderA", loserId: "founderB" }, auth: { uid: "admin" } })).rejects.toThrow(/already merged/i);
  });
});

describe("mergeIdentities (org merge)", () => {
  beforeEach(async () => {
    await seedMerge();
    await db.doc("startups/sA").set({ founderId: "founderA", name: "Acme", district: "Kolkata", teamMemberUids: [] });
    await db.doc("dealEntries/dealX").set({ startupId: "sB", founderId: "founderA", investorUid: "inv", stage: "interest" });
  });
  it("reassigns startupId references to the survivor org and tombstones the loser org", async () => {
    const res = (await wrappedMerge({ data: { recordType: "startups", survivorId: "sA", loserId: "sB" }, auth: { uid: "admin" } })) as { reassigned: number };
    expect(res.reassigned).toBeGreaterThanOrEqual(2);
    expect((await db.doc("applications/aB").get()).data()!.startupId).toBe("sA");
    expect((await db.doc("dealEntries/dealX").get()).data()!.startupId).toBe("sA");
    expect((await db.doc("startups/sB").get()).data()!.mergedInto).toBe("sA");
  });
});
