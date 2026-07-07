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
