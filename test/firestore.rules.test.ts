import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";

const PROJECT_ID = "demo-aic-techno";
const DAY = 24 * 60 * 60 * 1000;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

/** Seed a realistic fixture with rules bypassed. */
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();

    const user = (id: string, role: string, approvalStatus = "approved", extra = {}) =>
      setDoc(doc(db, "users", id), {
        uid: id,
        email: `${id}@x.com`,
        name: id,
        role,
        approvalStatus,
        createdAt: now,
        updatedAt: now,
        ...extra,
      });

    await Promise.all([
      user("admin", "admin"),
      user("mgr", "cohort_manager"),
      user("evalA", "evaluator"),
      user("evalB", "evaluator"),
      user("founder", "founder"),
      user("intruder", "founder"),
      user("pending", "founder", "pending"),
    ]);

    const cohort = (id: string, status: string, extra = {}) =>
      setDoc(doc(db, "cohorts", id), {
        name: id,
        sectorFocus: ["AgriTech"],
        eligibilityRules: "x",
        scoringRubric: "x",
        capacity: 2,
        selectedCount: 0,
        status,
        applicationOpenAt: Timestamp.fromMillis(now.toMillis() - DAY),
        applicationCloseAt: Timestamp.fromMillis(now.toMillis() + DAY),
        createdBy: "mgr",
        createdAt: now,
        updatedAt: now,
        ...extra,
      });

    await Promise.all([
      cohort("open", "open"),
      cohort("closed", "closed"),
      cohort("draft", "draft"),
      cohort("full", "open", { capacity: 1, selectedCount: 1 }),
    ]);

    const startup = (id: string, extra = {}) =>
      setDoc(doc(db, "startups", id), {
        founderId: "founder",
        name: id,
        sector: "AgriTech",
        district: "Kolkata",
        stage: "MVP",
        description: "desc",
        teamMembers: [],
        teamMemberUids: [],
        createdAt: now,
        updatedAt: now,
        ...extra,
      });

    await Promise.all([
      startup("s1"),
      startup("s_inc", {
        incubation: {
          cohortId: "open",
          cohortName: "open",
          applicationId: "app_selected",
          onboarding: {
            acceptedOffer: false,
            consentGiven: false,
            baselineKpiCaptured: false,
            orientationComplete: false,
            founderVerified: false,
          },
        },
      }),
    ]);

    const app = (id: string, extra = {}) =>
      setDoc(doc(db, "applications", id), {
        cohortId: "open",
        cohortName: "open",
        founderId: "founder",
        startupId: "s1",
        startupName: "s1",
        sector: "AgriTech",
        district: "Kolkata",
        stage: "MVP",
        pitchSummary: "pitch",
        documentUrls: ["https://deck"],
        status: "draft",
        isComplete: false,
        isEligible: null,
        evaluatorIds: [],
        createdAt: now,
        updatedAt: now,
        ...extra,
      });

    await Promise.all([
      app("app_draft"),
      app("app_submitted", { status: "submitted", isComplete: true, evaluatorIds: ["evalA"] }),
      app("app_underreview", { status: "under_review", evaluatorIds: ["evalA"] }),
      app("app_locked", {
        status: "selected",
        evaluatorIds: ["evalA"],
        committeeDecision: { decision: "selected", decidedAt: now, locked: true },
      }),
    ]);

    // A private committee note for the read-leak test.
    await setDoc(doc(db, "applications", "app_locked", "review", "decision"), {
      decidedBy: "mgr",
      notes: "confidential",
      decidedAt: now,
    });

    // --- Phase 2 fixtures ---
    await db.doc("masters/m1").set({ type: "sector", label: "AgriTech", order: 0, active: true, createdAt: now, updatedAt: now });
    await db.doc("tickets/t1").set({
      kind: "service", title: "Need marketing help", category: "marketing", urgency: "medium",
      requiredOutcome: "landing page", requesterId: "founder", requesterName: "founder",
      startupId: "s1", providerId: "evalA", status: "assigned", notes: [], attachments: [],
      createdAt: now, updatedAt: now,
    });
    await db.doc("meetings/mt1").set({
      kind: "mentor", requesterId: "founder", requesterName: "founder", startupId: "s1",
      hostId: "evalA", hostName: "evalA", topic: "GTM", proposedAt: now, status: "requested",
      createdAt: now, updatedAt: now,
    });
    await db.doc("communications/c1").set({
      entityType: "startup", entityId: "s1", channel: "in_app", subject: "Hi", body: "Body",
      toUserId: "founder", sentBy: "mgr", at: now,
    });
    await db.doc("notificationTemplates/application.submitted").set({
      key: "application.submitted", channel: "email", subject: "Received", body: "Thanks {{name}}",
      active: true, createdAt: now, updatedAt: now,
    });
    await db.doc("documents/d1").set({
      ownerType: "startup", ownerId: "s1", category: "certificate", title: "Cert", version: 1,
      storagePath: "documents/startup/s1/cert.pdf", downloadUrl: "https://x", uploadedBy: "mgr",
      visibleTo: ["founder"], supersededBy: null, createdAt: now,
    });
    await db.doc("courses/course1").set({
      title: "GTM 101", description: "d", track: "mandatory", sector: null, sessions: [],
      active: true, createdBy: "mgr", createdAt: now, updatedAt: now,
    });
    await db.doc("enrollments/course1_s1").set({
      courseId: "course1", courseTitle: "GTM 101", track: "mandatory", startupId: "s1",
      founderId: "founder", attendedSessionIds: [], status: "enrolled", enrolledAt: now, updatedAt: now,
    });
    await db.doc("graduations/s1").set({
      startupId: "s1", startupName: "s1", cohortId: "open", founderId: "founder",
      criteria: [], score: 0, createdAt: now, updatedAt: now,
    });
    await db.doc("directory/dir1").set({
      kind: "mentor", name: "Jane Mentor", category: "GTM", description: "d", languages: [],
      expertise: ["sales"], equipment: [], services: [], active: true, createdBy: "mgr",
      createdAt: now, updatedAt: now,
    });
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

const db = (uid?: string) =>
  uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

describe("users", () => {
  it("a user may edit their own name/phone", async () => {
    await assertSucceeds(updateDoc(doc(db("founder"), "users", "founder"), { name: "New", updatedAt: Timestamp.now() }));
  });
  it("a user may NOT change their own role or approvalStatus", async () => {
    await assertFails(updateDoc(doc(db("pending"), "users", "pending"), { approvalStatus: "approved" }));
    await assertFails(updateDoc(doc(db("founder"), "users", "founder"), { role: "admin" }));
  });
  it("a user may NOT rewrite their own email (invite-hijack vector)", async () => {
    await assertFails(updateDoc(doc(db("intruder"), "users", "intruder"), { email: "founder@x.com" }));
  });
  it("an admin may approve any user", async () => {
    await assertSucceeds(
      updateDoc(doc(db("admin"), "users", "pending"), { approvalStatus: "approved", updatedAt: Timestamp.now() }),
    );
  });
  it("self-registration cannot mint an admin", async () => {
    await assertFails(
      setDoc(doc(db("intruder"), "users", "newguy"), { uid: "newguy", role: "admin", approvalStatus: "pending" }),
    );
  });
});

describe("applications — founder", () => {
  it("can create a clean draft against an OPEN cohort", async () => {
    await assertSucceeds(
      setDoc(doc(db("founder"), "applications", "open_founder"), {
        cohortId: "open", cohortName: "open", founderId: "founder", startupId: "s1",
        startupName: "s1", sector: "AgriTech", district: "Kolkata", stage: "MVP",
        pitchSummary: "", documentUrls: [], status: "draft", isComplete: false,
        isEligible: null, evaluatorIds: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
  it("canNOT create a draft against a CLOSED or DRAFT cohort", async () => {
    const base = {
      founderId: "founder", startupId: "s1", startupName: "s1", sector: "AgriTech",
      district: "Kolkata", stage: "MVP", pitchSummary: "", documentUrls: [], status: "draft",
      isComplete: false, isEligible: null, evaluatorIds: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    };
    await assertFails(setDoc(doc(db("founder"), "applications", "x1"), { ...base, cohortId: "closed", cohortName: "closed" }));
    await assertFails(setDoc(doc(db("founder"), "applications", "x2"), { ...base, cohortId: "draft", cohortName: "draft" }));
  });
  it("canNOT create a draft pre-loaded with eligibility/decision", async () => {
    await assertFails(
      setDoc(doc(db("founder"), "applications", "cheat"), {
        cohortId: "open", cohortName: "open", founderId: "founder", startupId: "s1",
        startupName: "s1", sector: "AgriTech", district: "Kolkata", stage: "MVP",
        pitchSummary: "", documentUrls: [], status: "draft", isComplete: false,
        isEligible: true, evaluatorIds: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
  it("can save their own draft", async () => {
    await assertSucceeds(
      updateDoc(doc(db("founder"), "applications", "app_draft"), {
        pitchSummary: "updated", documentUrls: ["https://d"], isComplete: true, updatedAt: Timestamp.now(),
      }),
    );
  });
  it("canNOT submit directly — submission is Cloud-Function-only", async () => {
    await assertFails(
      updateDoc(doc(db("founder"), "applications", "app_draft"), {
        status: "submitted", isComplete: true, submittedAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
  it("canNOT self-select their draft (status=selected / isEligible)", async () => {
    await assertFails(updateDoc(doc(db("founder"), "applications", "app_draft"), { status: "selected", updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(db("founder"), "applications", "app_draft"), { isEligible: true, updatedAt: Timestamp.now() }));
    await assertFails(
      updateDoc(doc(db("founder"), "applications", "app_draft"), {
        committeeDecision: { decision: "selected", locked: true, decidedAt: Timestamp.now() },
      }),
    );
  });
});

describe("applications — evaluator has NO parent-doc write", () => {
  it("an assigned evaluator canNOT write the application document", async () => {
    await assertFails(
      updateDoc(doc(db("evalA"), "applications", "app_submitted"), { status: "selected", updatedAt: Timestamp.now() }),
    );
  });
});

describe("applications — staff", () => {
  it("cohort_manager can assign evaluators (submitted -> under_review)", async () => {
    await assertSucceeds(
      updateDoc(doc(db("mgr"), "applications", "app_submitted"), {
        evaluatorIds: ["evalA", "evalB"], status: "under_review", updatedAt: Timestamp.now(),
      }),
    );
  });
  it("cohort_manager can set eligibility", async () => {
    await assertSucceeds(
      updateDoc(doc(db("mgr"), "applications", "app_underreview"), { isEligible: true, updatedAt: Timestamp.now() }),
    );
  });
  it("NO client (even admin) may write committeeDecision — decisions are Cloud-Function-only", async () => {
    await assertFails(
      updateDoc(doc(db("mgr"), "applications", "app_underreview"), {
        status: "rejected",
        committeeDecision: { decision: "rejected", locked: true, decidedAt: Timestamp.now() },
        updatedAt: Timestamp.now(),
      }),
    );
    await assertFails(
      updateDoc(doc(db("admin"), "applications", "app_underreview"), {
        status: "selected",
        committeeDecision: { decision: "selected", locked: true, decidedAt: Timestamp.now() },
        updatedAt: Timestamp.now(),
      }),
    );
  });
  it("NO client may transition status into a decision value directly", async () => {
    await assertFails(
      updateDoc(doc(db("mgr"), "applications", "app_underreview"), { status: "selected", updatedAt: Timestamp.now() }),
    );
  });
  it("NO client (even admin) may unlock a locked decision — reopen is Cloud-Function-only", async () => {
    await assertFails(
      updateDoc(doc(db("admin"), "applications", "app_locked"), { "committeeDecision.locked": false, updatedAt: Timestamp.now() }),
    );
  });
  it("staff canNOT corrupt founderId / createdAt", async () => {
    await assertFails(updateDoc(doc(db("mgr"), "applications", "app_submitted"), { founderId: "mgr", updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(db("mgr"), "applications", "app_submitted"), { createdAt: Timestamp.now() }));
  });
});

describe("cohorts", () => {
  it("staff can change status but NOT selectedCount (counter is Cloud-Function-only)", async () => {
    await assertSucceeds(
      updateDoc(doc(db("mgr"), "cohorts", "open"), { status: "closed", updatedAt: Timestamp.now() }),
    );
    await assertFails(
      updateDoc(doc(db("mgr"), "cohorts", "open"), { selectedCount: 99, updatedAt: Timestamp.now() }),
    );
  });
});

describe("applications/scores subcollection", () => {
  it("an assigned evaluator can write ONLY their own score doc", async () => {
    await assertSucceeds(
      setDoc(doc(db("evalA"), "applications", "app_submitted", "scores", "evalA"), {
        evaluatorId: "evalA", score: 8, comments: "good", conflictOfInterest: false, submittedAt: Timestamp.now(),
      }),
    );
  });
  it("an evaluator canNOT write another evaluator's score doc", async () => {
    await assertFails(
      setDoc(doc(db("evalA"), "applications", "app_submitted", "scores", "evalB"), {
        evaluatorId: "evalB", score: 1, comments: "", conflictOfInterest: false, submittedAt: Timestamp.now(),
      }),
    );
  });
  it("a NON-assigned evaluator canNOT score", async () => {
    await assertFails(
      setDoc(doc(db("evalB"), "applications", "app_submitted", "scores", "evalB"), {
        evaluatorId: "evalB", score: 5, comments: "", conflictOfInterest: false, submittedAt: Timestamp.now(),
      }),
    );
  });
  it("scoring a LOCKED application is denied", async () => {
    await assertFails(
      setDoc(doc(db("evalA"), "applications", "app_locked", "scores", "evalA"), {
        evaluatorId: "evalA", score: 5, comments: "", conflictOfInterest: false, submittedAt: Timestamp.now(),
      }),
    );
  });
  it("the founder canNOT read scores (reviewer notes stay private)", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "applications", "app_submitted", "scores", "evalA"), {
        evaluatorId: "evalA", score: 8, comments: "x", conflictOfInterest: false, submittedAt: Timestamp.now(),
      });
    });
    await assertFails(getDoc(doc(db("founder"), "applications", "app_submitted", "scores", "evalA")));
  });
});

describe("applications/review subcollection (committee notes)", () => {
  it("the founder canNOT read private committee notes", async () => {
    await assertFails(getDoc(doc(db("founder"), "applications", "app_locked", "review", "decision")));
  });
  it("staff CAN read private committee notes", async () => {
    await assertSucceeds(getDoc(doc(db("mgr"), "applications", "app_locked", "review", "decision")));
  });
});

describe("startups", () => {
  it("founder can create their own profile (not pre-selected)", async () => {
    await assertSucceeds(
      setDoc(doc(db("founder"), "startups", "s_new"), {
        founderId: "founder", name: "n", sector: "AgriTech", district: "Kolkata", stage: "MVP",
        description: "d", teamMembers: [], teamMemberUids: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
  it("founder canNOT create a startup already carrying incubation", async () => {
    await assertFails(
      setDoc(doc(db("founder"), "startups", "s_cheat"), {
        founderId: "founder", name: "n", sector: "AgriTech", district: "Kolkata", stage: "MVP",
        description: "d", teamMembers: [], teamMemberUids: [],
        incubation: { cohortId: "open", cohortName: "open", applicationId: "z", onboarding: {} },
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
  it("founder can toggle their own onboarding item", async () => {
    await assertSucceeds(
      updateDoc(doc(db("founder"), "startups", "s_inc"), {
        "incubation.onboarding.acceptedOffer": true, updatedAt: Timestamp.now(),
      }),
    );
  });
  it("founder canNOT self-set founderVerified", async () => {
    await assertFails(
      updateDoc(doc(db("founder"), "startups", "s_inc"), {
        "incubation.onboarding.founderVerified": true, updatedAt: Timestamp.now(),
      }),
    );
  });
  it("founder canNOT change which cohort they were selected into", async () => {
    await assertFails(
      updateDoc(doc(db("founder"), "startups", "s_inc"), {
        "incubation.cohortId": "full", updatedAt: Timestamp.now(),
      }),
    );
  });
  it("staff (cohort_manager) CAN verify the founder", async () => {
    await assertSucceeds(
      updateDoc(doc(db("mgr"), "startups", "s_inc"), {
        "incubation.onboarding.founderVerified": true, updatedAt: Timestamp.now(),
      }),
    );
  });
  it("a non-owner founder canNOT read someone else's startup", async () => {
    await assertFails(getDoc(doc(db("intruder"), "startups", "s1")));
  });
});

describe("kpiSnapshots", () => {
  it("founder can append a snapshot but never edit or delete it", async () => {
    await assertSucceeds(
      setDoc(doc(db("founder"), "startups", "s1", "kpiSnapshots", "k1"), {
        capturedAt: Timestamp.now(), revenueBand: "Pre-revenue", customers: 0, teamSize: 1, fundsRaised: 0, isBaseline: true,
      }),
    );
    await assertFails(updateDoc(doc(db("founder"), "startups", "s1", "kpiSnapshots", "k1"), { customers: 5 }));
    await assertFails(deleteDoc(doc(db("founder"), "startups", "s1", "kpiSnapshots", "k1")));
  });
});

describe("auditLog", () => {
  it("a user can append events attributed to themselves but not read the log", async () => {
    await assertSucceeds(
      setDoc(doc(db("founder"), "auditLog", "e1"), {
        actorId: "founder", actorRole: "founder", action: "user.register", entityType: "user",
        entityId: "founder", timestamp: Timestamp.now(),
      }),
    );
    await assertFails(getDoc(doc(db("founder"), "auditLog", "e1")));
  });
  it("a client canNOT forge a Cloud-Function-owned audit action", async () => {
    await assertFails(
      setDoc(doc(db("mgr"), "auditLog", "forge"), {
        actorId: "mgr", actorRole: "cohort_manager", action: "application.decide", entityType: "application",
        entityId: "app_underreview", timestamp: Timestamp.now(),
      }),
    );
  });
  it("only an admin can read the audit log", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "auditLog", "e2"), {
        actorId: "mgr", actorRole: "cohort_manager", action: "cohort.create", entityType: "cohort",
        entityId: "open", timestamp: Timestamp.now(),
      });
    });
    await assertSucceeds(getDoc(doc(db("admin"), "auditLog", "e2")));
    await assertFails(getDoc(doc(db("mgr"), "auditLog", "e2")));
  });
});

// ===================== Phase 2 core primitives =====================

describe("masters", () => {
  it("approved users read, only admins write", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "masters", "m1")));
    await assertFails(getDoc(doc(db(), "masters", "m1")));
    await assertSucceeds(
      setDoc(doc(db("admin"), "masters", "m2"), { type: "sector", label: "FoodTech", order: 1, active: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }),
    );
    await assertFails(
      setDoc(doc(db("mgr"), "masters", "m3"), { type: "sector", label: "X", order: 2, active: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }),
    );
  });
});

describe("tickets", () => {
  it("requester and assigned provider can read; a stranger cannot", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "tickets", "t1")));
    await assertSucceeds(getDoc(doc(db("evalA"), "tickets", "t1")));
    await assertSucceeds(getDoc(doc(db("mgr"), "tickets", "t1")));
    await assertFails(getDoc(doc(db("intruder"), "tickets", "t1")));
  });
  it("a founder creates a ticket they own; cannot forge another requester", async () => {
    await assertSucceeds(
      setDoc(doc(db("founder"), "tickets", "t2"), {
        kind: "service", title: "T", category: "marketing", urgency: "low", requiredOutcome: "x",
        requesterId: "founder", requesterName: "founder", status: "open", notes: [], attachments: [],
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
    await assertFails(
      setDoc(doc(db("founder"), "tickets", "t3"), {
        kind: "service", title: "T", category: "marketing", urgency: "low", requiredOutcome: "x",
        requesterId: "intruder", requesterName: "x", status: "open", notes: [], attachments: [],
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
});

describe("meetings", () => {
  it("requester + host read; requester creates; stranger denied", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "meetings", "mt1")));
    await assertSucceeds(getDoc(doc(db("evalA"), "meetings", "mt1")));
    await assertFails(getDoc(doc(db("intruder"), "meetings", "mt1")));
    await assertSucceeds(
      setDoc(doc(db("founder"), "meetings", "mt2"), {
        kind: "mentor", requesterId: "founder", requesterName: "founder", hostId: "evalA", hostName: "e",
        topic: "x", proposedAt: Timestamp.now(), status: "requested", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
});

describe("communications", () => {
  it("addressee reads their own; append-only; sender is pinned", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "communications", "c1")));
    await assertFails(getDoc(doc(db("intruder"), "communications", "c1")));
    await assertFails(updateDoc(doc(db("mgr"), "communications", "c1"), { subject: "edited" }));
    await assertFails(
      setDoc(doc(db("mgr"), "communications", "c2"), {
        entityType: "startup", entityId: "s1", channel: "in_app", subject: "s", body: "b",
        sentBy: "founder", at: Timestamp.now(), // sentBy != caller
      }),
    );
  });
});

describe("notificationTemplates", () => {
  it("approved users read (so notifyStage works), only admins write", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "notificationTemplates", "application.submitted")));
    await assertFails(getDoc(doc(db(), "notificationTemplates", "application.submitted")));
    await assertSucceeds(
      setDoc(doc(db("admin"), "notificationTemplates", "k2"), { key: "k2", channel: "email", subject: "s", body: "b", active: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }),
    );
    await assertFails(
      setDoc(doc(db("mgr"), "notificationTemplates", "k3"), { key: "k3", channel: "email", subject: "s", body: "b", active: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }),
    );
  });
});

describe("documents", () => {
  it("uploader + visibleTo + staff read; others denied; append-only delete", async () => {
    await assertSucceeds(getDoc(doc(db("mgr"), "documents", "d1")));       // staff
    await assertSucceeds(getDoc(doc(db("founder"), "documents", "d1")));   // on visibleTo
    await assertFails(getDoc(doc(db("intruder"), "documents", "d1")));
    await assertFails(deleteDoc(doc(db("mgr"), "documents", "d1")));
  });
  it("a user uploads a doc they own; cannot forge uploadedBy", async () => {
    await assertSucceeds(
      setDoc(doc(db("founder"), "documents", "d2"), {
        ownerType: "startup", ownerId: "s1", category: "pitch", title: "T", version: 1,
        storagePath: "documents/startup/s1/x", downloadUrl: "https://x", uploadedBy: "founder",
        visibleTo: [], supersededBy: null, createdAt: Timestamp.now(),
      }),
    );
    await assertFails(
      setDoc(doc(db("founder"), "documents", "d3"), {
        ownerType: "startup", ownerId: "s1", category: "pitch", title: "T", version: 1,
        storagePath: "x", downloadUrl: "https://x", uploadedBy: "mgr",
        visibleTo: [], supersededBy: null, createdAt: Timestamp.now(),
      }),
    );
  });
});

describe("training", () => {
  it("approved users read the catalogue; staff manage courses", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "courses", "course1")));
    await assertSucceeds(
      setDoc(doc(db("mgr"), "courses", "c2"), {
        title: "T", description: "d", track: "elective", sessions: [], active: true,
        createdBy: "mgr", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
    await assertFails(
      setDoc(doc(db("founder"), "courses", "c3"), {
        title: "T", description: "d", track: "elective", sessions: [], active: true,
        createdBy: "founder", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
  it("founder marks attendance but canNOT self-assess or self-complete", async () => {
    await assertSucceeds(
      updateDoc(doc(db("founder"), "enrollments", "course1_s1"), {
        attendedSessionIds: ["s0"], status: "in_progress", updatedAt: Timestamp.now(),
      }),
    );
    await assertFails(
      updateDoc(doc(db("founder"), "enrollments", "course1_s1"), { assessmentScore: 95, updatedAt: Timestamp.now() }),
    );
    await assertFails(
      updateDoc(doc(db("founder"), "enrollments", "course1_s1"), {
        status: "completed", certificateDocId: "x", updatedAt: Timestamp.now(),
      }),
    );
  });
  it("staff records assessment and completes", async () => {
    await assertSucceeds(
      updateDoc(doc(db("mgr"), "enrollments", "course1_s1"), {
        assessmentScore: 88, feedback: "good", status: "completed", certificateDocId: "cert1", updatedAt: Timestamp.now(),
      }),
    );
  });
  it("a stranger cannot read another startup's enrollment", async () => {
    await assertFails(getDoc(doc(db("intruder"), "enrollments", "course1_s1")));
  });
});

describe("directory", () => {
  it("approved users browse; staff curate; founders cannot write", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "directory", "dir1")));
    await assertFails(getDoc(doc(db(), "directory", "dir1")));
    await assertSucceeds(
      setDoc(doc(db("mgr"), "directory", "dir2"), {
        kind: "fablab", name: "Lab", category: "prototyping", description: "d", languages: [],
        expertise: [], equipment: [{ name: "3D printer" }], services: [], active: true,
        createdBy: "mgr", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
    await assertFails(
      setDoc(doc(db("founder"), "directory", "dir3"), {
        kind: "mentor", name: "X", category: "c", description: "d", languages: [],
        expertise: [], equipment: [], services: [], active: true, createdBy: "founder",
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
});

describe("graduation", () => {
  it("staff write the scorecard; the founder reads their own; others denied", async () => {
    await assertSucceeds(
      setDoc(doc(db("mgr"), "graduations", "s1"), {
        startupId: "s1", startupName: "s1", cohortId: "open", founderId: "founder",
        criteria: [], score: 50, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }, { merge: true }),
    );
    await assertSucceeds(getDoc(doc(db("founder"), "graduations", "s1")));
    await assertFails(getDoc(doc(db("intruder"), "graduations", "s1")));
    await assertFails(
      setDoc(doc(db("founder"), "graduations", "s1"), { score: 100 }, { merge: true }),
    );
  });
});
