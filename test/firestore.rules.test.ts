import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
      // Phase 4 new roles: approved but pending identity verification, and a
      // verified variant — both must still be denied everywhere on Day 1.
      user("inv", "investor", "approved", { identityStatus: "pending_verification" }),
      user("invV", "investor", "approved", { identityStatus: "verified" }),
      user("ado", "probasi_adopter", "approved", { identityStatus: "pending_verification" }),
      user("adoV", "probasi_adopter", "approved", { identityStatus: "verified" }),
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

    // --- Phase 3 fixtures ---
    await db.doc("consents/contactA_outreach").set({
      startupId: "s1", founderId: "founder", contactId: "contactA", purpose: "outreach",
      granted: true, source: "form", updatedAt: now,
    });
    await db.doc("crmContacts/contactA").set({
      startupId: "s1", founderId: "founder", name: "Lead A", contributedByUid: "founder",
      contributedByName: "founder", createdAt: now, updatedAt: now,
    });
    await db.doc("crmOpportunities/oppA").set({
      startupId: "s1", founderId: "founder", title: "Deal A", stage: "qualified", value: 100000,
      createdAt: now, updatedAt: now,
    });
    await db.doc("financeEntries/finA").set({
      startupId: "s1", founderId: "founder", kind: "invoice", description: "Inv", amount: 5000,
      paid: true, occurredAt: now, createdAt: now,
    });
    await db.doc("opsSummary/s1").set({
      startupId: "s1", founderId: "founder", startupName: "s1", pipelineValue: 100000,
      openOpportunities: 1, wonOpportunities: 0, wonValue: 0, invoicedTotal: 5000,
      expenseTotal: 0, cashPosition: 5000, updatedAt: now,
    });
    await db.doc("ipCases/ipTicket1").set({
      ticketId: "ipTicket1", startupId: "s1", founderId: "founder", ipType: "patent",
      feeCredits: 0, createdAt: now, updatedAt: now,
    });
    await db.doc("ndaAgreements/nda1").set({
      startupId: "s1", founderId: "founder", templateKey: "mutual", signerUid: "evalA",
      signerName: "evalA", unlocksDocId: "d1", status: "pending", createdBy: "founder", createdAt: now,
    });
    await db.doc("campaigns/camp1").set({
      startupId: "s1", founderId: "founder", name: "Q3 push", channel: "email",
      brief: { segment: "SMB", valueProp: "v", goal: "demo" }, contactIds: ["contactA"],
      status: "draft", createdAt: now, updatedAt: now,
    });
    await db.doc("aiUsage/use1").set({
      startupId: "s1", uid: "founder", model: "stub", totalTokens: 100, at: now,
    });

    // --- Phase 4 fixtures ---
    await db.doc("investors/invV").set({ uid: "invV", name: "Inv V", sectors: [], ticketMinLakh: 5, ticketMaxLakh: 50, geographies: [], stagePreferences: [], portfolio: "", languages: [], engagement: "active", createdAt: now, updatedAt: now });
    await db.doc("startupInvestorProfiles/s1").set({
      startupId: "s1", founderId: "founder", startupName: "s1", pitch: "p", traction: "t", team: "tm",
      financialSummary: "f", fundingAskLakh: 100, useOfFunds: "u", documentIds: ["d1"], status: "published", createdAt: now, updatedAt: now,
    });
    await db.doc("startupInvestorProfiles/s_inc").set({
      startupId: "s_inc", founderId: "founder", startupName: "s_inc", pitch: "p", traction: "t", team: "tm",
      financialSummary: "f", fundingAskLakh: 50, useOfFunds: "u", documentIds: [], status: "in_review", createdAt: now, updatedAt: now,
    });
    await db.doc("dataRoomRequests/dr1").set({ startupId: "s1", founderId: "founder", startupName: "s1", investorUid: "invV", investorName: "Inv V", message: "m", status: "requested", createdAt: now });
    await db.doc("dataRoomAccessLog/log1").set({ startupId: "s1", founderId: "founder", investorUid: "invV", action: "granted", at: now, by: "founder" });
    await db.doc("dealEntries/deal1").set({ startupId: "s1", startupName: "s1", founderId: "founder", investorUid: "invV", investorName: "Inv V", stage: "interest", notes: "", createdBy: "invV", createdAt: now, updatedAt: now });
    await db.doc("pitchEvents/pe1").set({ title: "Pitch", description: "d", at: now, status: "open", investorUids: ["invV"], shortlistStartupIds: ["s1"], shortlistFounderIds: ["founder"], createdBy: "mgr", createdAt: now, updatedAt: now });
    await db.doc("adopters/adoV").set({ uid: "adoV", name: "Ado V", location: "London", sectorExpertise: [], languages: [], availability: "", contributionModes: ["mentor"], createdAt: now, updatedAt: now });
    await db.doc("adoptionRequests/ar1").set({ startupId: "s1", founderId: "founder", startupName: "s1", adopterUid: "adoV", adopterName: "Ado V", modes: ["mentor"], message: "m", status: "requested", createdAt: now });
    await db.doc("adoptionWorkspaces/s1_adoV").set({ startupId: "s1", founderId: "founder", startupName: "s1", adopterUid: "adoV", adopterName: "Ado V", modes: ["mentor"], goals: "", commitments: "", impact: { mentorHours: 0, salesLeads: 0, meetings: 0, fundsCommittedLakh: 0, introductions: 0, docsReviewed: 0 }, createdAt: now, updatedAt: now });
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

// ===================== Phase 3 =====================

describe("consent (AIO-04)", () => {
  it("founder reads/owns; staff read; stranger denied; revoke is an update", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "consents", "contactA_outreach")));
    await assertSucceeds(getDoc(doc(db("mgr"), "consents", "contactA_outreach")));
    await assertFails(getDoc(doc(db("intruder"), "consents", "contactA_outreach")));
    await assertSucceeds(
      updateDoc(doc(db("founder"), "consents", "contactA_outreach"), { granted: false, updatedAt: Timestamp.now() }),
    );
    await assertFails(deleteDoc(doc(db("founder"), "consents", "contactA_outreach")));
  });
  it("a founder cannot forge consent under another founder", async () => {
    await assertFails(
      setDoc(doc(db("intruder"), "consents", "x_outreach"), {
        startupId: "s1", founderId: "founder", contactId: "x", purpose: "outreach",
        granted: true, source: "f", updatedAt: Timestamp.now(),
      }),
    );
  });
});

describe("CRM + finance raw rows are founder-only (OPS-06)", () => {
  it("owner reads their CRM/finance rows; STAFF cannot read raw rows", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "crmContacts", "contactA")));
    await assertSucceeds(getDoc(doc(db("founder"), "crmOpportunities", "oppA")));
    await assertSucceeds(getDoc(doc(db("founder"), "financeEntries", "finA")));
    await assertFails(getDoc(doc(db("mgr"), "crmContacts", "contactA")));
    await assertFails(getDoc(doc(db("mgr"), "crmOpportunities", "oppA")));
    await assertFails(getDoc(doc(db("mgr"), "financeEntries", "finA")));
  });
  it("a sales mentor / staff may CONTRIBUTE a lead (create) without read access", async () => {
    await assertSucceeds(
      setDoc(doc(db("mgr"), "crmContacts", "contribLead"), {
        startupId: "s1", founderId: "founder", name: "Contributed", contributedByUid: "mgr",
        contributedByName: "mgr", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
  it("finance entries are append-only", async () => {
    await assertFails(updateDoc(doc(db("founder"), "financeEntries", "finA"), { amount: 1 }));
    await assertFails(deleteDoc(doc(db("founder"), "financeEntries", "finA")));
  });
});

describe("opsSummary rollup (OPS-06)", () => {
  it("staff read the aggregate rollup; the founder owns it; a stranger cannot read", async () => {
    await assertSucceeds(getDoc(doc(db("mgr"), "opsSummary", "s1")));
    await assertSucceeds(getDoc(doc(db("founder"), "opsSummary", "s1")));
    await assertFails(getDoc(doc(db("intruder"), "opsSummary", "s1")));
  });
});

describe("IP support (IP-01/02)", () => {
  it("founder opens a case companion + IP ticket; staff read; founder can't set fee credits", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "ipCases", "ipTicket1")));
    await assertSucceeds(getDoc(doc(db("mgr"), "ipCases", "ipTicket1")));
    await assertFails(getDoc(doc(db("intruder"), "ipCases", "ipTicket1")));
    // fee/credit is staff-only (IP desk)
    await assertFails(updateDoc(doc(db("founder"), "ipCases", "ipTicket1"), { feeCredits: 500 }));
    await assertSucceeds(updateDoc(doc(db("mgr"), "ipCases", "ipTicket1"), { feeCredits: 500, updatedAt: Timestamp.now() }));
  });
  it("a founder can open an IP-kind ticket via the shared tickets primitive", async () => {
    await assertSucceeds(
      setDoc(doc(db("founder"), "tickets", "ipTicketNew"), {
        kind: "ip", title: "Patent", category: "patent", urgency: "medium", requiredOutcome: "file",
        requesterId: "founder", requesterName: "founder", startupId: "s1", status: "open",
        notes: [], attachments: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
});

describe("NDA agreements (IP-04)", () => {
  it("founder, signer, and staff read; a stranger cannot", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "ndaAgreements", "nda1")));
    await assertSucceeds(getDoc(doc(db("evalA"), "ndaAgreements", "nda1"))); // signer
    await assertSucceeds(getDoc(doc(db("mgr"), "ndaAgreements", "nda1")));
    await assertFails(getDoc(doc(db("intruder"), "ndaAgreements", "nda1")));
  });
  it("the signer can mark it signed", async () => {
    await assertSucceeds(
      updateDoc(doc(db("evalA"), "ndaAgreements", "nda1"), { status: "signed", signedAt: Timestamp.now() }),
    );
  });
});

describe("outreach campaigns + AI usage (AIO)", () => {
  it("campaigns are founder-owned; staff cannot read raw drafts; delete blocked", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "campaigns", "camp1")));
    await assertFails(getDoc(doc(db("mgr"), "campaigns", "camp1")));
    await assertFails(getDoc(doc(db("intruder"), "campaigns", "camp1")));
    await assertFails(deleteDoc(doc(db("founder"), "campaigns", "camp1")));
  });
  it("a founder creates a campaign under their own id only", async () => {
    await assertSucceeds(
      setDoc(doc(db("founder"), "campaigns", "campNew"), {
        startupId: "s1", founderId: "founder", name: "N", channel: "email",
        brief: { segment: "x", valueProp: "v", goal: "g" }, contactIds: [], status: "draft",
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
    await assertFails(
      setDoc(doc(db("intruder"), "campaigns", "campForge"), {
        startupId: "s1", founderId: "founder", name: "N", channel: "email",
        brief: { segment: "x", valueProp: "v", goal: "g" }, contactIds: [], status: "draft",
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
  it("aiUsage is server-authored only — clients cannot write; founder/staff read", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "aiUsage", "use1")));
    await assertSucceeds(getDoc(doc(db("mgr"), "aiUsage", "use1")));
    await assertFails(getDoc(doc(db("intruder"), "aiUsage", "use1")));
    await assertFails(
      setDoc(doc(db("founder"), "aiUsage", "forge"), {
        startupId: "s1", uid: "founder", model: "x", totalTokens: 1, at: Timestamp.now(),
      }),
    );
  });
});

// ===================== Phase 4 Day 1 — deny-by-default role audit =====================

describe("Phase 4 roles: investor & probasi_adopter are denied by default", () => {
  // Every sensitive collection seeded in the fixture, plus the five catalog
  // collections now narrowed to incumbent roles. NONE should be readable by the
  // new roles on Day 1 — verified or not — because no feature has granted access.
  const READ_TARGETS: [string, string][] = [
    ["startups", "s1"],
    ["applications", "app_submitted"],
    ["crmContacts", "contactA"],
    ["crmOpportunities", "oppA"],
    ["financeEntries", "finA"],
    ["opsSummary", "s1"],
    ["campaigns", "camp1"],
    ["aiUsage", "use1"],
    ["documents", "d1"],
    ["tickets", "t1"],
    ["meetings", "mt1"],
    ["communications", "c1"],
    ["consents", "contactA_outreach"],
    ["ndaAgreements", "nda1"],
    ["ipCases", "ipTicket1"],
    ["graduations", "s1"],
    ["enrollments", "course1_s1"],
    // Catalog collections tightened to incumbents on Day 1:
    ["masters", "m1"],
    ["cohorts", "open"],
    ["courses", "course1"],
    ["directory", "dir1"],
    ["notificationTemplates", "application.submitted"],
  ];

  for (const uid of ["inv", "invV", "ado"]) {
    it(`${uid} is denied read on every collection`, async () => {
      for (const [col, id] of READ_TARGETS) {
        await assertFails(getDoc(doc(db(uid), col, id)));
      }
    });
  }

  it("new roles cannot write into feature collections", async () => {
    await assertFails(
      setDoc(doc(db("inv"), "startups", "hack"), {
        founderId: "inv", name: "x", sector: "s", district: "d", stage: "MVP",
        description: "d", teamMembers: [], teamMemberUids: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
    await assertFails(
      setDoc(doc(db("ado"), "crmContacts", "hack"), {
        startupId: "s1", founderId: "ado", name: "x", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
    await assertFails(
      setDoc(doc(db("inv"), "campaigns", "hack"), {
        startupId: "s1", founderId: "inv", name: "x", channel: "email",
        brief: { segment: "s", valueProp: "v", goal: "g" }, contactIds: [], status: "draft",
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });

  it("a new-role user reads their OWN user doc but cannot self-verify identity", async () => {
    await assertSucceeds(getDoc(doc(db("inv"), "users", "inv")));
    // profile-only self edits still allowed
    await assertSucceeds(
      updateDoc(doc(db("inv"), "users", "inv"), { name: "New Name", updatedAt: Timestamp.now() }),
    );
    // self-setting identityStatus is NOT in the profile allow-list → denied
    await assertFails(
      updateDoc(doc(db("inv"), "users", "inv"), { identityStatus: "verified" }),
    );
  });

  it("only an admin can verify a new role's identity", async () => {
    await assertFails(
      updateDoc(doc(db("mgr"), "users", "inv"), { identityStatus: "verified", updatedAt: Timestamp.now() }),
    );
    await assertSucceeds(
      updateDoc(doc(db("admin"), "users", "inv"), {
        identityStatus: "verified", identityVerifiedBy: "admin", identityVerifiedAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });

  it("regression: incumbent roles still read the catalog collections", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "masters", "m1")));
    await assertSucceeds(getDoc(doc(db("founder"), "cohorts", "open")));
    await assertSucceeds(getDoc(doc(db("evalA"), "courses", "course1")));
    await assertSucceeds(getDoc(doc(db("founder"), "directory", "dir1")));
    await assertSucceeds(getDoc(doc(db("mgr"), "notificationTemplates", "application.submitted")));
  });

  it("a new-role user can self-register as pending (create own user doc)", async () => {
    await assertSucceeds(
      setDoc(doc(db("newinv"), "users", "newinv"), {
        uid: "newinv", email: "newinv@x.com", name: "New Inv", role: "investor",
        approvalStatus: "pending", identityStatus: "pending_verification",
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      }),
    );
  });
});

// ===================== Phase 4 — investor + adoption cross-role grants =====================

describe("Phase 4: investor community", () => {
  it("investor owns their own profile; staff read; others denied", async () => {
    await assertSucceeds(getDoc(doc(db("invV"), "investors", "invV")));
    await assertSucceeds(getDoc(doc(db("mgr"), "investors", "invV")));
    await assertFails(getDoc(doc(db("founder"), "investors", "invV")));
    await assertSucceeds(setDoc(doc(db("inv"), "investors", "inv"), {
      uid: "inv", name: "x", sectors: [], ticketMinLakh: 1, ticketMaxLakh: 2, geographies: [], stagePreferences: [], portfolio: "", languages: [], engagement: "active", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }));
    // a founder cannot create an investor profile
    await assertFails(setDoc(doc(db("founder"), "investors", "founder"), {
      uid: "founder", name: "x", sectors: [], ticketMinLakh: 1, ticketMaxLakh: 2, geographies: [], stagePreferences: [], portfolio: "", languages: [], engagement: "active", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }));
  });

  it("startup investor-facing profile: verified investor reads PUBLISHED only; unverified denied", async () => {
    await assertSucceeds(getDoc(doc(db("invV"), "startupInvestorProfiles", "s1")));       // published
    await assertFails(getDoc(doc(db("invV"), "startupInvestorProfiles", "s_inc")));        // in_review — not published
    await assertFails(getDoc(doc(db("inv"), "startupInvestorProfiles", "s1")));            // unverified investor
    await assertSucceeds(getDoc(doc(db("adoV"), "startupInvestorProfiles", "s1")));        // verified adopter discovery
    await assertSucceeds(getDoc(doc(db("founder"), "startupInvestorProfiles", "s1")));     // owner
  });

  it("founder can't self-publish; staff can publish", async () => {
    await assertFails(updateDoc(doc(db("founder"), "startupInvestorProfiles", "s_inc"), { status: "published" }));
    await assertSucceeds(updateDoc(doc(db("founder"), "startupInvestorProfiles", "s_inc"), { status: "in_review", pitch: "p2" }));
    await assertSucceeds(updateDoc(doc(db("mgr"), "startupInvestorProfiles", "s_inc"), { status: "published", reviewedBy: "mgr" }));
  });

  it("data room: verified investor requests; unverified cannot; founder decides", async () => {
    await assertSucceeds(setDoc(doc(db("invV"), "dataRoomRequests", "drNew"), {
      startupId: "s1", founderId: "founder", startupName: "s1", investorUid: "invV", investorName: "Inv V", message: "m", status: "requested", createdAt: Timestamp.now(),
    }));
    await assertFails(setDoc(doc(db("inv"), "dataRoomRequests", "drBad"), {
      startupId: "s1", founderId: "founder", startupName: "s1", investorUid: "inv", investorName: "Inv", message: "m", status: "requested", createdAt: Timestamp.now(),
    }));
    await assertSucceeds(updateDoc(doc(db("founder"), "dataRoomRequests", "dr1"), { status: "approved", decidedBy: "founder", decidedAt: Timestamp.now() }));
  });

  it("deal pipeline: verified investor creates + advances stage (label only)", async () => {
    await assertSucceeds(updateDoc(doc(db("invV"), "dealEntries", "deal1"), { stage: "diligence", updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(db("founder"), "dealEntries", "deal1"), { stage: "term", updatedAt: Timestamp.now() }));
    await assertFails(getDoc(doc(db("intruder"), "dealEntries", "deal1")));
  });

  it("pitch event: invited verified investor + shortlisted founder read; feedback by investor", async () => {
    await assertSucceeds(getDoc(doc(db("invV"), "pitchEvents", "pe1")));
    await assertSucceeds(getDoc(doc(db("founder"), "pitchEvents", "pe1")));
    await assertFails(getDoc(doc(db("inv"), "pitchEvents", "pe1")));   // not invited (and unverified)
    await assertSucceeds(setDoc(doc(db("invV"), "pitchEvents", "pe1", "feedback", "invV"), {
      investorUid: "invV", investorName: "Inv V", startupId: "s1", note: "great", at: Timestamp.now(),
    }));
  });
});

describe("Phase 4: Probasi adoption", () => {
  it("adopter owns their profile; verification gates requests", async () => {
    await assertSucceeds(getDoc(doc(db("adoV"), "adopters", "adoV")));
    await assertFails(getDoc(doc(db("founder"), "adopters", "adoV")));
    // verified adopter can request; unverified cannot
    await assertSucceeds(setDoc(doc(db("adoV"), "adoptionRequests", "arNew"), {
      startupId: "s1", founderId: "founder", startupName: "s1", adopterUid: "adoV", adopterName: "Ado V", modes: ["mentor"], message: "m", status: "requested", createdAt: Timestamp.now(),
    }));
    await assertFails(setDoc(doc(db("ado"), "adoptionRequests", "arBad"), {
      startupId: "s1", founderId: "founder", startupName: "s1", adopterUid: "ado", adopterName: "Ado", modes: ["mentor"], message: "m", status: "requested", createdAt: Timestamp.now(),
    }));
  });

  it("adoption workspace: founder + adopter member read/update; adopter updates impact", async () => {
    await assertSucceeds(getDoc(doc(db("founder"), "adoptionWorkspaces", "s1_adoV")));
    await assertSucceeds(getDoc(doc(db("adoV"), "adoptionWorkspaces", "s1_adoV")));
    await assertFails(getDoc(doc(db("intruder"), "adoptionWorkspaces", "s1_adoV")));
    await assertSucceeds(updateDoc(doc(db("adoV"), "adoptionWorkspaces", "s1_adoV"), { goals: "grow", updatedAt: Timestamp.now() }));
  });

  it("ABS-09: verified adopter records OWN acknowledgement consent, but NOT outreach consent", async () => {
    await assertSucceeds(setDoc(doc(db("adoV"), "consents", "adoV_coi"), {
      startupId: "adoV", founderId: "adoV", contactId: "adoV", purpose: "coi", granted: true, source: "ack", updatedAt: Timestamp.now(),
    }));
    await assertFails(setDoc(doc(db("adoV"), "consents", "adoV_outreach"), {
      startupId: "adoV", founderId: "adoV", contactId: "adoV", purpose: "outreach", granted: true, source: "x", updatedAt: Timestamp.now(),
    }));
  });

  it("ABS-06: adopter with an active workspace contributes a CRM lead; without one, denied", async () => {
    await assertSucceeds(setDoc(doc(db("adoV"), "crmContacts", "leadFromAdopter"), {
      startupId: "s1", founderId: "founder", name: "Lead", contributedByUid: "adoV", contributedByName: "Ado V", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }));
    // s_inc has no workspace for adoV → denied
    await assertFails(setDoc(doc(db("adoV"), "crmContacts", "leadNoWs"), {
      startupId: "s_inc", founderId: "founder", name: "Lead", contributedByUid: "adoV", contributedByName: "Ado V", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }));
  });
});

// ===================== Hardening — duplicate candidates (IDM-02) =====================

describe("duplicateCandidates (IDM-02) — staff-only review queue", () => {
  it("staff read/write; non-staff denied; client can't forge an identity.merge audit entry", async () => {
    const cand = {
      subject: "person", recordType: "users", recordIdA: "a", recordIdB: "b", labelA: "A", labelB: "B",
      matchReason: "name+phone", matchedOn: ["name", "phone"], status: "open", detectedBy: "scan",
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    };
    await assertSucceeds(setDoc(doc(db("mgr"), "duplicateCandidates", "users__a__b"), cand));
    await assertSucceeds(getDoc(doc(db("admin"), "duplicateCandidates", "users__a__b")));
    await assertFails(getDoc(doc(db("founder"), "duplicateCandidates", "users__a__b")));
    await assertFails(setDoc(doc(db("founder"), "duplicateCandidates", "users__x__y"), cand));
    await assertFails(getDoc(doc(db("invV"), "duplicateCandidates", "users__a__b")));

    // The tamper-proof merge audit action can't be written by a client.
    await assertFails(
      setDoc(doc(db("admin"), "auditLog", "forge"), {
        actorId: "admin", actorRole: "admin", action: "identity.merge", entityType: "identity",
        entityId: "x", timestamp: Timestamp.now(),
      }),
    );
  });
});

describe("loginEvents (SEC-05) — own-uid only, append-only", () => {
  it("a user reads/creates only their own login events; can't read others or mutate", async () => {
    await assertSucceeds(
      setDoc(doc(db("founder"), "loginEvents", "le1"), { uid: "founder", fingerprint: "abc", userAgent: "x", at: Timestamp.now() }),
    );
    await assertSucceeds(getDoc(doc(db("founder"), "loginEvents", "le1")));
    await assertFails(getDoc(doc(db("intruder"), "loginEvents", "le1")));
    await assertFails(
      setDoc(doc(db("intruder"), "loginEvents", "le2"), { uid: "founder", fingerprint: "z", userAgent: "x", at: Timestamp.now() }),
    );
    await assertFails(updateDoc(doc(db("founder"), "loginEvents", "le1"), { fingerprint: "changed" }));
  });
});

// ===================== Phase 4 end-to-end flows (cross-role, real rules) =====================

describe("E2E flow (a): investor data room — request → approve → grant → view → logged", () => {
  it("runs the full chain and enforces access at each step", async () => {
    // A founder-owned data-room document (founder can grant it).
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("documents/drDoc").set({
        ownerType: "startup", ownerId: "s1", category: "pitch", title: "Deck", version: 1,
        storagePath: "", downloadUrl: "", uploadedBy: "founder", visibleTo: ["founder"], supersededBy: null, createdAt: Timestamp.now(),
      });
    });
    // Before any grant, the investor cannot read the doc.
    await assertFails(getDoc(doc(db("invV"), "documents", "drDoc")));
    // 1. verified investor requests access.
    await assertSucceeds(setDoc(doc(db("invV"), "dataRoomRequests", "flowReq"), {
      startupId: "s1", founderId: "founder", startupName: "s1", investorUid: "invV", investorName: "Inv V",
      message: "m", status: "requested", createdAt: Timestamp.now(),
    }));
    // 2. founder approves.
    await assertSucceeds(updateDoc(doc(db("founder"), "dataRoomRequests", "flowReq"), {
      status: "approved", decidedBy: "founder", decidedAt: Timestamp.now(),
    }));
    // 3. founder grants the investor read access (visibleTo) + 4. logs the grant.
    await assertSucceeds(updateDoc(doc(db("founder"), "documents", "drDoc"), { visibleTo: ["founder", "invV"] }));
    await assertSucceeds(setDoc(doc(db("founder"), "dataRoomAccessLog", "logGrant"), {
      startupId: "s1", founderId: "founder", investorUid: "invV", action: "granted", at: Timestamp.now(), by: "founder",
    }));
    // 5. NOW the investor can read the document; 6. logs a view.
    await assertSucceeds(getDoc(doc(db("invV"), "documents", "drDoc")));
    await assertSucceeds(setDoc(doc(db("invV"), "dataRoomAccessLog", "logView"), {
      startupId: "s1", founderId: "founder", investorUid: "invV", action: "viewed", at: Timestamp.now(), by: "invV",
    }));
    // A different (unauthorized) investor still cannot read it.
    await assertFails(getDoc(doc(db("inv"), "documents", "drDoc")));
    // The founder sees both log entries.
    const grant = await getDoc(doc(db("founder"), "dataRoomAccessLog", "logGrant"));
    const view = await getDoc(doc(db("founder"), "dataRoomAccessLog", "logView"));
    expect(grant.exists()).toBe(true);
    expect(view.data()?.action).toBe("viewed");
  });
});

describe("E2E flow (b): adopter contributes a CRM lead with correct attribution", () => {
  it("adopter with an active workspace adds a lead the founder sees, attributed to the adopter", async () => {
    // Workspace s1_adoV exists in the seed (founder accepted adoV).
    await assertSucceeds(setDoc(doc(db("adoV"), "crmContacts", "flowLead"), {
      startupId: "s1", founderId: "founder", name: "Contributed Lead",
      contributedByUid: "adoV", contributedByName: "Ado V", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }));
    // The founder reads the lead and sees the adopter attribution.
    const snap = await getDoc(doc(db("founder"), "crmContacts", "flowLead"));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.contributedByUid).toBe("adoV");
    expect(snap.data()?.contributedByName).toBe("Ado V");
    // An adopter WITHOUT a workspace for that startup cannot contribute.
    await assertFails(setDoc(doc(db("adoV"), "crmContacts", "flowLeadBad"), {
      startupId: "s_inc", founderId: "founder", name: "X",
      contributedByUid: "adoV", contributedByName: "Ado V", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    }));
  });
});
