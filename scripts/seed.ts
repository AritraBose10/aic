#!/usr/bin/env npx tsx
/**
 * Firestore seed / revert script for all platform features.
 *
 * Usage:
 *   npm run seed          # populate all collections for all users
 *   npm run seed:revert   # delete only seeded documents (seeded == true or seed_*)
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key,
 * or Application Default Credentials (gcloud auth application-default login).
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ── Bootstrap ────────────────────────────────────────────────────────────────

const REVERT = process.argv.includes("--revert");

initializeApp({
  credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : applicationDefault(),
});

const db = getFirestore();

// ── Helpers ──────────────────────────────────────────────────────────────────

function ts(offsetDays = 0): Timestamp {
  return Timestamp.fromDate(
    new Date(Date.now() + offsetDays * 86_400_000),
  );
}

const now = ts(0);

// Firestore batches are capped at 500 ops. We use a helper that auto-commits.
class BatchWriter {
  private batch = db.batch();
  private count = 0;
  private total = 0;

  async set(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) {
    this.batch.set(ref, { ...data, seeded: true });
    this.count++;
    this.total++;
    if (this.count >= 450) {
      await this.batch.commit();
      this.batch = db.batch();
      this.count = 0;
    }
  }

  async delete(ref: FirebaseFirestore.DocumentReference) {
    this.batch.delete(ref);
    this.count++;
    this.total++;
    if (this.count >= 450) {
      await this.batch.commit();
      this.batch = db.batch();
      this.count = 0;
    }
  }

  async flush() {
    if (this.count > 0) {
      await this.batch.commit();
      this.count = 0;
    }
    return this.total;
  }
}

// ── Masters ──────────────────────────────────────────────────────────────────

const MASTER_ENTRIES: { id: string; type: string; label: string; order: number }[] = [
  // Sectors
  { id: "seed_master_sector_01", type: "sector", label: "Deep Tech / AI", order: 1 },
  { id: "seed_master_sector_02", type: "sector", label: "Agri-Tech", order: 2 },
  { id: "seed_master_sector_03", type: "sector", label: "FinTech", order: 3 },
  { id: "seed_master_sector_04", type: "sector", label: "Health Tech", order: 4 },
  // Districts
  { id: "seed_master_district_01", type: "district", label: "Kolkata", order: 1 },
  { id: "seed_master_district_02", type: "district", label: "Howrah", order: 2 },
  { id: "seed_master_district_03", type: "district", label: "North 24 Parganas", order: 3 },
  // Stages
  { id: "seed_master_stage_01", type: "stage", label: "Ideation", order: 1 },
  { id: "seed_master_stage_02", type: "stage", label: "Prototype", order: 2 },
  { id: "seed_master_stage_03", type: "stage", label: "Revenue", order: 3 },
  // Service categories
  { id: "seed_master_svc_01", type: "serviceCategory", label: "Legal", order: 1 },
  { id: "seed_master_svc_02", type: "serviceCategory", label: "Accounting", order: 2 },
  // Provider categories
  { id: "seed_master_prov_01", type: "providerCategory", label: "CA firm", order: 1 },
  // Training tracks
  { id: "seed_master_track_01", type: "trainingTrack", label: "Mandatory", order: 1 },
  // Document categories
  { id: "seed_master_doccat_01", type: "documentCategory", label: "Pitch deck", order: 1 },
];

// ── SEED ─────────────────────────────────────────────────────────────────────

async function seed() {
  const b = new BatchWriter();

  // 1. Fetch all real users from the database first
  const realUsersSnap = await db.collection("users").get();
  const realUsers: { uid: string; name: string; email: string; role: string }[] = [];
  realUsersSnap.forEach((doc) => {
    if (!doc.id.startsWith("seed_")) {
      const data = doc.data();
      realUsers.push({
        uid: doc.id,
        name: data.name || "Test User",
        email: data.email || "",
        role: data.role || "founder",
      });
    }
  });

  // Combine with default seed users to guarantee we have all roles represented
  const defaultSeedUsers = [
    { uid: "seed_user_admin", email: "ananya.sen@example.com", name: "Ananya Sen", role: "admin" },
    { uid: "seed_user_cm", email: "rajeev.dutta@example.com", name: "Rajeev Dutta", role: "cohort_manager" },
    { uid: "seed_user_founder", email: "priya.banerjee@example.com", name: "Priya Banerjee", role: "founder" },
    { uid: "seed_user_investor", email: "sanjay.ghosh@example.com", name: "Sanjay Ghosh", role: "investor" },
    { uid: "seed_user_evaluator", email: "meera.roy@example.com", name: "Meera Roy", role: "evaluator" },
    { uid: "seed_user_adopter", email: "arjun.dasgupta@example.com", name: "Arjun Dasgupta", role: "probasi_adopter" },
  ];

  // Map all target users (real + seed)
  const targetUsersMap = new Map<string, { uid: string; name: string; email: string; role: string }>();
  for (const u of [...defaultSeedUsers, ...realUsers]) {
    targetUsersMap.set(u.uid, u);
  }
  const allUsers = Array.from(targetUsersMap.values());

  // ── Seed / Update User Documents ──
  const userBase = { approvalStatus: "approved", createdAt: ts(-30), updatedAt: now };
  for (const u of allUsers) {
    if (u.uid.startsWith("seed_")) {
      // Create seed users
      await b.set(db.doc(`users/${u.uid}`), {
        uid: u.uid,
        email: u.email,
        name: u.name,
        role: u.role,
        ...(u.role === "investor" || u.role === "probasi_adopter"
          ? { identityStatus: "verified", identityVerifiedBy: "seed_user_admin", identityVerifiedAt: ts(-20) }
          : {}),
        ...userBase,
      });
    } else {
      // Ensure real users are approved so they can read/write data in the application
      const userRef = db.doc(`users/${u.uid}`);
      await userRef.update({ approvalStatus: "approved" });
    }
  }

  // Seed two pending users specifically to populate the admin "Approvals" view
  await b.set(db.doc(`users/seed_user_pending_founder`), {
    uid: "seed_user_pending_founder",
    email: "pending.founder@example.com",
    name: "Subir Gupta",
    role: "founder",
    approvalStatus: "pending",
    registrationNote: "Building green logistics solutions for agricultural produce.",
    createdAt: ts(-2),
    updatedAt: ts(-2),
  });
  await b.set(db.doc(`users/seed_user_pending_investor`), {
    uid: "seed_user_pending_investor",
    email: "pending.investor@example.com",
    name: "Rohan Sen",
    role: "investor",
    approvalStatus: "approved", // user is approved, but identity is pending verification
    identityStatus: "pending_verification",
    registrationNote: "Looking to invest in early stage clean-energy startups.",
    createdAt: ts(-3),
    updatedAt: ts(-3),
  });

  // ── Global Masters ──
  for (const m of MASTER_ENTRIES) {
    await b.set(db.doc(`masters/${m.id}`), {
      id: m.id, type: m.type, label: m.label, order: m.order, active: true, createdAt: ts(-60), updatedAt: ts(-60),
    });
  }

  // ── Global Cohorts ──
  await b.set(db.doc(`cohorts/seed_cohort_01`), {
    id: "seed_cohort_01", name: "Bengal Launchpad 2025 — Deep Tech", sectorFocus: ["Deep Tech / AI", "Agri-Tech"],
    eligibilityRules: "Registered in West Bengal, pre-Series A, DPIIT recognised or applied",
    scoringRubric: "Innovation (30), Market (25), Team (25), Traction (20)",
    capacity: 20, selectedCount: allUsers.length,
    applicationOpenAt: ts(-60), applicationCloseAt: ts(-30),
    status: "closed", createdBy: "seed_user_cm", createdAt: ts(-90), updatedAt: ts(-30),
  });
  await b.set(db.doc(`cohorts/seed_cohort_02`), {
    id: "seed_cohort_02", name: "Green Bengal 2026 — ClimateTech", sectorFocus: ["Agri-Tech"],
    eligibilityRules: "Climate / sustainability focus, pre-revenue or early revenue",
    scoringRubric: "Impact (30), Scalability (25), Team (25), Innovation (20)",
    capacity: 15, selectedCount: 0,
    applicationOpenAt: ts(-5), applicationCloseAt: ts(30),
    status: "open", createdBy: "seed_user_admin", createdAt: ts(-10), updatedAt: ts(-5),
  });

  // ── Global Courses ──
  await b.set(db.doc(`courses/seed_course_01`), {
    id: "seed_course_01", title: "Startup Fundamentals — Business Model Canvas", description: "Mandatory training on lean startup methodology, value proposition design, and business model iteration for all cohort founders.",
    track: "mandatory", sessions: [
      { id: "seed_session_1a", title: "Introduction to Lean Canvas", scheduledAt: ts(-70) },
      { id: "seed_session_1b", title: "Customer Discovery Workshop", scheduledAt: ts(-63) },
      { id: "seed_session_1c", title: "Revenue Model Design", scheduledAt: ts(-56) },
    ],
    active: true, createdBy: "seed_user_cm", createdAt: ts(-80), updatedAt: ts(-56),
  });
  await b.set(db.doc(`courses/seed_course_02`), {
    id: "seed_course_02", title: "Investor Readiness — Pitch Mastery", description: "Elective course on crafting compelling investor narratives, financial modelling for fundraise, and pitch delivery technique.",
    track: "investor_readiness", sessions: [
      { id: "seed_session_2a", title: "The 10-Slide Pitch Framework", scheduledAt: ts(-40) },
      { id: "seed_session_2b", title: "Financial Modelling for Seed Stage", scheduledAt: ts(-33) },
    ],
    active: true, createdBy: "seed_user_cm", createdAt: ts(-50), updatedAt: ts(-33),
  });

  // ── Global Directory Entries ──
  await b.set(db.doc(`directory/seed_dir_mentor`), {
    id: "seed_dir_mentor", kind: "mentor", name: "Dr. Sunil Chatterjee",
    category: "Business strategy", description: "20+ years experience in agribusiness strategy. Former VP at ITC Agri Business. Mentor at NSRCEL and TIG AIC.",
    location: "Kolkata", languages: ["Bengali", "Hindi", "English"],
    expertise: ["Go-to-market strategy", "Agribusiness", "B2B sales", "Channel partnerships"],
    equipment: [], services: [],
    active: true, createdBy: "seed_user_admin", createdAt: ts(-100), updatedAt: ts(-50),
  });
  await b.set(db.doc(`directory/seed_dir_fablab`), {
    id: "seed_dir_fablab", kind: "fablab", name: "TIG Innovation Lab",
    category: "IoT & Electronics", description: "Full-service prototyping lab with PCB fabrication, 3D printing, CNC machining, and IoT sensor assembly stations.",
    location: "Salt Lake, Kolkata", languages: ["English", "Bengali"],
    expertise: [], equipment: [
      { name: "3D Printer (Prusa MK4)", safetyPrereq: "Basic 3D printing orientation" },
      { name: "PCB Mill (Bantam Tools)", safetyPrereq: "Electronics safety certification" },
      { name: "Soldering Station" },
      { name: "IoT Sensor Kit (Arduino / Raspberry Pi)" },
    ],
    services: [],
    active: true, createdBy: "seed_user_admin", createdAt: ts(-100), updatedAt: ts(-60),
  });
  await b.set(db.doc(`directory/seed_dir_provider`), {
    id: "seed_dir_provider", kind: "provider", name: "Bengal Legal Associates",
    category: "Legal", description: "Corporate law firm specialising in startup incorporation, IP filing, and regulatory compliance in West Bengal.",
    location: "Park Street, Kolkata", languages: ["English", "Bengali", "Hindi"],
    expertise: [], equipment: [],
    services: ["Company registration", "Trademark filing", "Patent applications", "DPIIT recognition", "FSSAI licensing"],
    sla: "5 business days for initial consultation",
    active: true, createdBy: "seed_user_admin", createdAt: ts(-100), updatedAt: ts(-80),
  });

  // ── Seed Features For Every Single Target User ──
  // This maps mock startup profiles, opportunities, and all role views to every single user UID,
  // ensuring they have data pre-populated when navigating the sidebar regardless of their role.
  for (const u of allUsers) {
    const startup1 = `seed_startup_01_${u.uid}`;
    const startup2 = `seed_startup_02_${u.uid}`;
    const app1 = `seed_app_01_${u.uid}`;
    const app2 = `seed_app_02_${u.uid}`;
    const ticketService = `seed_ticket_service_${u.uid}`;
    const ticketHelpdesk = `seed_ticket_helpdesk_${u.uid}`;
    const ticketIp = `seed_ticket_ip_${u.uid}`;
    const meetingMentor = `seed_meeting_mentor_${u.uid}`;
    const meetingFablab = `seed_meeting_fablab_${u.uid}`;
    const doc1 = `seed_doc_01_${u.uid}`;
    const doc2 = `seed_doc_02_${u.uid}`;
    const enrollment1 = `seed_enrollment_01_${u.uid}`;
    const enrollment2 = `seed_enrollment_02_${u.uid}`;
    const consent1 = `seed_consent_01_${u.uid}`;
    const consent2 = `seed_consent_02_${u.uid}`;
    const contact1 = `seed_crm_contact_01_${u.uid}`;
    const contact2 = `seed_crm_contact_02_${u.uid}`;
    const contact3 = `seed_crm_contact_03_${u.uid}`;
    const opp1 = `seed_crm_opp_01_${u.uid}`;
    const opp2 = `seed_crm_opp_02_${u.uid}`;
    const fin1 = `seed_finance_01_${u.uid}`;
    const fin2 = `seed_finance_02_${u.uid}`;
    const fin3 = `seed_finance_03_${u.uid}`;
    const campaign1 = `seed_campaign_01_${u.uid}`;
    const nda1 = `seed_nda_01_${u.uid}`;
    const dataRoomReq = `seed_dr_req_01_${u.uid}`;
    const deal1 = `seed_deal_01_${u.uid}`;
    const adoptionReq = `seed_adoption_req_01_${u.uid}`;
    const adoptionWs = `seed_startup_01_${u.uid}_seed_user_adopter`;

    // ── Startups ──
    await b.set(db.doc(`startups/${startup1}`), {
      id: startup1, founderId: u.uid, name: `KrishiMitra AI`,
      sector: "Agri-Tech", district: "Kolkata", stage: "Revenue",
      description: `AI-powered crop health advisory for smallholder farmers, created for ${u.name}.`,
      teamMembers: [], teamMemberUids: [],
      incubation: {
        cohortId: "seed_cohort_01", cohortName: "Bengal Launchpad 2025 — Deep Tech",
        applicationId: app1,
        onboarding: { acceptedOffer: true, consentGiven: true, baselineKpiCaptured: true, orientationComplete: true, founderVerified: true },
      },
      createdAt: ts(-90), updatedAt: now,
    });
    await b.set(db.doc(`startups/${startup2}`), {
      id: startup2, founderId: u.uid, name: `FinBridge Bengal`,
      sector: "FinTech", district: "Howrah", stage: "Prototype",
      description: `Digital credit scoring and micro-enterprise lending, created for ${u.name}.`,
      teamMembers: [], teamMemberUids: [],
      createdAt: ts(-40), updatedAt: ts(-5),
    });

    // ── KPI Snapshots ──
    await b.set(db.doc(`startups/${startup1}/kpiSnapshots/seed_kpi_01_${u.uid}`), {
      id: `seed_kpi_01_${u.uid}`, capturedAt: ts(-80), revenueBand: "0–1L", customers: 12, teamSize: 3, fundsRaised: 0,
      notes: "Baseline at cohort entry", isBaseline: true,
    });
    await b.set(db.doc(`startups/${startup1}/kpiSnapshots/seed_kpi_02_${u.uid}`), {
      id: `seed_kpi_02_${u.uid}`, capturedAt: ts(-50), revenueBand: "1–5L", customers: 85, teamSize: 5, fundsRaised: 500000,
      notes: "Q1 progress — pilot with 3 FPOs", isBaseline: false,
    });

    // ── Applications ──
    await b.set(db.doc(`applications/${app1}`), {
      id: app1, cohortId: "seed_cohort_01", cohortName: "Bengal Launchpad 2025 — Deep Tech",
      founderId: u.uid, startupId: startup1, startupName: `KrishiMitra AI`,
      sector: "Agri-Tech", district: "Kolkata", stage: "Revenue",
      pitchSummary: "AI crop advisory pest detection algorithm seeking incubation support.",
      documentUrls: [], status: "selected", isComplete: true, isEligible: true,
      evaluatorIds: ["seed_user_evaluator"],
      committeeDecision: { decision: "selected", decidedAt: ts(-35), locked: true },
      submittedAt: ts(-55), createdAt: ts(-60), updatedAt: ts(-35),
    });
    await b.set(db.doc(`applications/${app2}`), {
      id: app2, cohortId: "seed_cohort_02", cohortName: "Green Bengal 2026 — ClimateTech",
      founderId: u.uid, startupId: startup2, startupName: `FinBridge Bengal`,
      sector: "FinTech", district: "Howrah", stage: "Prototype",
      pitchSummary: "Digital credit platform for micro-enterprises.",
      documentUrls: [], status: "submitted", isComplete: true, isEligible: null,
      evaluatorIds: ["seed_user_evaluator"],
      submittedAt: ts(-3), createdAt: ts(-5), updatedAt: ts(-3),
    });

    // ── Application Scores (Evaluations) ──
    await b.set(db.doc(`applications/${app1}/scores/seed_user_evaluator`), {
      evaluatorId: "seed_user_evaluator", score: 88, comments: "Excellent traction and pilot results. Strongly recommend selection.",
      conflictOfInterest: false, submittedAt: ts(-40),
    });
    // If the user itself acts as an evaluator, assign this application to them to view
    await b.set(db.doc(`applications/${app2}/scores/${u.uid}`), {
      evaluatorId: u.uid, score: 75, comments: "Solid prototype, ready for cohort assessment.",
      conflictOfInterest: false, submittedAt: ts(-1),
    });

    // ── Application Reviews ──
    await b.set(db.doc(`applications/${app1}/review/decision`), {
      decidedBy: "seed_user_cm", notes: "Top scorer in deep tech category.", decidedAt: ts(-35),
    });

    // ── Tickets (Support / Services / IP cases) ──
    await b.set(db.doc(`tickets/${ticketService}`), {
      id: ticketService, kind: "service", title: "Company registration (Section 8)",
      category: "Legal", urgency: "medium", requiredOutcome: "Complete registration with MCA",
      requesterId: u.uid, requesterName: u.name, startupId: startup1,
      providerId: "seed_dir_provider", providerName: "Bengal Legal Associates",
      status: "in_progress",
      notes: [{ authorId: u.uid, authorName: u.name, body: "Need help finalizing Section 8 documentation.", at: ts(-15) }],
      attachments: [], createdAt: ts(-15), updatedAt: ts(-10),
    });
    await b.set(db.doc(`tickets/${ticketHelpdesk}`), {
      id: ticketHelpdesk, kind: "helpdesk", title: "Platform feedback / file upload issue",
      category: "Platform support", urgency: "low", requiredOutcome: "Help uploading large attachments",
      requesterId: u.uid, requesterName: u.name,
      status: "resolved",
      notes: [{ authorId: u.uid, authorName: u.name, body: "File limits are restricting my pitch deck upload.", at: ts(-20) }],
      attachments: [], completionEvidence: "Limits adjusted", rating: 5,
      createdAt: ts(-20), updatedAt: ts(-18),
    });
    await b.set(db.doc(`tickets/${ticketIp}`), {
      id: ticketIp, kind: "ip", title: "Patent filing — crop disease detection algorithm",
      category: "Patent", urgency: "high", requiredOutcome: "File provisional patent application",
      requesterId: u.uid, requesterName: u.name, startupId: startup1,
      status: "assigned",
      notes: [{ authorId: u.uid, authorName: u.name, body: "Model is completed and ready for filing.", at: ts(-8) }],
      attachments: [], createdAt: ts(-8), updatedAt: ts(-6),
    });

    // ── IP Case Ledger ──
    await b.set(db.doc(`ipCases/${ticketIp}`), {
      id: ticketIp, ticketId: ticketIp, startupId: startup1, founderId: u.uid,
      ipType: "patent", feeCredits: 25000,
      createdAt: ts(-8), updatedAt: ts(-6),
    });

    // ── Meetings (Mentors / Fab labs) ──
    await b.set(db.doc(`meetings/${meetingMentor}`), {
      id: meetingMentor, kind: "mentor",
      requesterId: u.uid, requesterName: u.name, startupId: startup1,
      hostId: "seed_dir_mentor", hostName: "Dr. Sunil Chatterjee",
      topic: "Go-to-market strategy for FPO partnerships",
      proposedAt: ts(-12), scheduledAt: ts(-8), status: "completed",
      notes: "Discussed channels to reach agribusiness cooperatives.",
      durationMinutes: 45, rating: 5,
      createdAt: ts(-12), updatedAt: ts(-8),
    });
    await b.set(db.doc(`meetings/${meetingFablab}`), {
      id: meetingFablab, kind: "fablab",
      requesterId: u.uid, requesterName: u.name, startupId: startup1,
      hostId: "seed_dir_fablab", hostName: "TIG Innovation Lab",
      resourceId: "seed_dir_fablab", resourceName: "TIG Innovation Lab",
      topic: "3D prototype mill session",
      proposedAt: ts(-5), scheduledAt: ts(2), status: "scheduled",
      createdAt: ts(-5), updatedAt: ts(-3),
    });

    // ── Documents ──
    await b.set(db.doc(`documents/${doc1}`), {
      id: doc1, ownerType: "startup", ownerId: startup1,
      category: "Pitch deck", title: "KrishiMitra AI — Pitch Deck Q2 2025",
      version: 2, storagePath: `startups/${startup1}/pitch_deck_v2.pdf`,
      downloadUrl: "https://example.com/placeholder.pdf",
      uploadedBy: u.uid, visibleTo: ["seed_user_investor"],
      createdAt: ts(-20),
    });
    await b.set(db.doc(`documents/${doc2}`), {
      id: doc2, ownerType: "startup", ownerId: startup1,
      category: "Financial", title: "KrishiMitra AI — P&L Statement FY24-25",
      version: 1, storagePath: `startups/${startup1}/pl_fy2425.pdf`,
      downloadUrl: "https://example.com/placeholder2.pdf",
      uploadedBy: u.uid, visibleTo: [],
      createdAt: ts(-10),
    });

    // ── Enrollments ──
    await b.set(db.doc(`enrollments/${enrollment1}`), {
      id: enrollment1, courseId: "seed_course_01", courseTitle: "Startup Fundamentals — Business Model Canvas",
      track: "mandatory", startupId: startup1, founderId: u.uid,
      attendedSessionIds: ["seed_session_1a", "seed_session_1b", "seed_session_1c"],
      assessmentScore: 85, status: "completed",
      feedback: "Strong customer discovery work.",
      enrolledAt: ts(-75), updatedAt: ts(-50), completedAt: ts(-50),
    });
    await b.set(db.doc(`enrollments/${enrollment2}`), {
      id: enrollment2, courseId: "seed_course_02", courseTitle: "Investor Readiness — Pitch Mastery",
      track: "investor_readiness", startupId: startup1, founderId: u.uid,
      attendedSessionIds: ["seed_session_2a"],
      status: "in_progress",
      enrolledAt: ts(-42), updatedAt: ts(-33),
    });

    // ── Graduations ──
    await b.set(db.doc(`graduations/${startup1}`), {
      id: startup1, startupId: startup1, startupName: `KrishiMitra AI`,
      cohortId: "seed_cohort_01", founderId: u.uid,
      criteria: [
        { key: "training", label: "Mandatory training completed", met: true },
        { key: "milestones", label: "Milestones achieved", met: true },
        { key: "kpis", label: "KPI targets met", met: true },
        { key: "compliance", label: "Compliance & documents in order", met: true },
        { key: "investor_ready", label: "Investor-readiness materials ready", met: false },
      ],
      score: 80, decision: "graduated", decidedBy: "seed_user_cm", decidedAt: ts(-2),
      createdAt: ts(-10), updatedAt: ts(-2),
    });

    // ── Consents ──
    await b.set(db.doc(`consents/${consent1}`), {
      id: consent1, startupId: startup1, founderId: u.uid,
      contactId: contact1, contactEmail: "rajesh.kumar@example.com",
      purpose: "outreach", granted: true, source: "In-app consent form",
      grantedAt: ts(-15), updatedAt: ts(-15),
    });
    await b.set(db.doc(`consents/${consent2}`), {
      id: consent2, startupId: startup1, founderId: u.uid,
      contactId: contact2, contactEmail: "neha.sharma@example.com",
      purpose: "data_sharing", granted: true, source: "Email confirmation",
      grantedAt: ts(-12), updatedAt: ts(-12),
    });

    // ── CRM Contacts ──
    await b.set(db.doc(`crmContacts/${contact1}`), {
      id: contact1, startupId: startup1, founderId: u.uid,
      name: "Rajesh Kumar", email: "rajesh.kumar@example.com", company: "Burdwan Farmers Cooperative",
      contributedByUid: u.uid, contributedByName: u.name,
      createdAt: ts(-20), updatedAt: ts(-15),
    });
    await b.set(db.doc(`crmContacts/${contact2}`), {
      id: contact2, startupId: startup1, founderId: u.uid,
      name: "Neha Sharma", email: "neha.sharma@example.com", company: "AgriNext Ventures",
      createdAt: ts(-18), updatedAt: ts(-12),
    });
    await b.set(db.doc(`crmContacts/${contact3}`), {
      id: contact3, startupId: startup1, founderId: u.uid,
      name: "Amit Patel", email: "amit.patel@example.com", company: "NABARD Regional Office",
      contributedByUid: "seed_dir_mentor", contributedByName: "Dr. Sunil Chatterjee",
      createdAt: ts(-10), updatedAt: ts(-10),
    });

    // ── CRM Opportunities ──
    await b.set(db.doc(`crmOpportunities/${opp1}`), {
      id: opp1, startupId: startup1, founderId: u.uid,
      contactId: contact1, title: "Burdwan FPO — pilot deployment (50 sensors)",
      stage: "proposal", value: 350000, notes: "Proposal submitted for 50-sensor deployment. Awaiting final FPO signature.",
      createdAt: ts(-18), updatedAt: ts(-5),
    });
    await b.set(db.doc(`crmOpportunities/${opp2}`), {
      id: opp2, startupId: startup1, founderId: u.uid,
      contactId: contact2, title: "AgriNext Ventures — strategic partnership",
      stage: "qualified", value: 1500000, notes: "Exploratory discussion for cross-state distribution.",
      createdAt: ts(-12), updatedAt: ts(-8),
    });

    // ── Finance Entries ──
    await b.set(db.doc(`financeEntries/${fin1}`), {
      id: fin1, startupId: startup1, founderId: u.uid,
      kind: "invoice", description: "Burdwan FPO Pilot invoice (50%)",
      amount: 175000, paid: true, occurredAt: ts(-15), createdAt: ts(-15),
    });
    await b.set(db.doc(`financeEntries/${fin2}`), {
      id: fin2, startupId: startup1, founderId: u.uid,
      kind: "invoice", description: "Monthly SaaS advisory subscription (85 farmers)",
      amount: 42500, paid: false, occurredAt: ts(-5), createdAt: ts(-5),
    });
    await b.set(db.doc(`financeEntries/${fin3}`), {
      id: fin3, startupId: startup1, founderId: u.uid,
      kind: "expense", description: "IoT microchips batch order",
      amount: 120000, occurredAt: ts(-12), createdAt: ts(-12),
    });

    // ── Ops Config ──
    await b.set(db.doc(`opsConfig/${startup1}`), {
      id: startup1, startupId: startup1, founderId: u.uid,
      crmMode: "built_in", financeMode: "built_in",
      updatedAt: ts(-20),
    });

    // ── Ops Summary ──
    await b.set(db.doc(`opsSummary/${startup1}`), {
      id: startup1, startupId: startup1, founderId: u.uid, startupName: `KrishiMitra AI`,
      pipelineValue: 1850000, openOpportunities: 2, wonOpportunities: 0, wonValue: 0,
      invoicedTotal: 217500, expenseTotal: 120000, cashPosition: 97500,
      outreachSent: 45, outreachResponses: 12, outreachConversions: 3, outreachSalesValue: 350000,
      adoptionMentorHours: 12, adoptionSalesLeads: 3, adoptionFundsCommittedLakh: 0, adoptionIntroductions: 5,
      updatedAt: now,
    });

    // ── Campaigns (Outreach) ──
    await b.set(db.doc(`campaigns/${campaign1}`), {
      id: campaign1, startupId: startup1, founderId: u.uid,
      name: "FPO Partnership Outreach — Bengal", channel: "email",
      brief: {
        segment: "Farmer Producer Organisations in West Bengal",
        valueProp: "AI-powered crop advisory increasing yield by 15-20% and reducing costs.",
        goal: "Book advisory sales calls.",
      },
      contactIds: [contact1, contact3],
      draft: "Dear FPO Manager,\n\nWe would like to introduce KrishiMitra AI to your cooperative. Let us know if you have 15 minutes next week.\n\nBest,\nPriya Banerjee",
      status: "approved", approvedBy: u.uid, approvedAt: ts(-10),
      outcome: { sent: 1, responses: 1, meetings: 1, conversions: 0, salesValue: 0, updatedAt: ts(-5) },
      createdAt: ts(-12), updatedAt: ts(-5),
    });

    // ── NDA Agreements ──
    await b.set(db.doc(`ndaAgreements/${nda1}`), {
      id: nda1, startupId: startup1, founderId: u.uid,
      templateKey: "mutual", signerUid: "seed_user_investor", signerName: "Sanjay Ghosh",
      unlocksDocId: doc2, status: "signed",
      signedDocId: doc1, createdBy: u.uid,
      createdAt: ts(-15), signedAt: ts(-12),
    });

    // ── Investor Profile (Singleton per user uid) ──
    // Seeding this under the user's actual UID so that when they test as an investor, they have a profile
    await b.set(db.doc(`investors/${u.uid}`), {
      id: u.uid, uid: u.uid, name: u.name,
      sectors: ["Deep Tech / AI", "Agri-Tech", "FinTech"],
      ticketMinLakh: 10, ticketMaxLakh: 50,
      geographies: ["West Bengal", "Odisha", "Jharkhand"],
      stagePreferences: ["Prototype", "Revenue"],
      portfolio: `5 active seed investments in regional deep-tech startups. Managed by ${u.name}.`,
      languages: ["Bengali", "Hindi", "English"],
      engagement: "active",
      createdAt: ts(-25), updatedAt: ts(-5),
    });

    // ── Startup Investor Profile (Startup's investor profile) ──
    await b.set(db.doc(`startupInvestorProfiles/${startup1}`), {
      id: startup1, startupId: startup1, founderId: u.uid, startupName: `KrishiMitra AI`,
      pitch: "KrishiMitra AI delivers crop health advisories using AI and satellite imagery.",
      traction: "₹5.5L MRR, 340 paying farmers, 3 FPO pilots completed successfully.",
      team: "CEO Priya Banerjee (IIT CS) + 2 ML Engineers",
      financialSummary: "FY25 revenue ₹8.5L, burn ₹3L/mo.",
      fundingAskLakh: 100, useOfFunds: "ML model extension and field operations",
      documentIds: [doc1, doc2],
      status: "published", reviewedBy: "seed_user_cm",
      createdAt: ts(-20), updatedAt: ts(-8),
    });

    // ── Data Room Requests ──
    await b.set(db.doc(`dataRoomRequests/${dataRoomReq}`), {
      id: dataRoomReq, startupId: startup1, founderId: u.uid, startupName: `KrishiMitra AI`,
      investorUid: "seed_user_investor", investorName: "Sanjay Ghosh",
      message: "Requesting access to due diligence folder.",
      status: "approved", decidedBy: u.uid,
      createdAt: ts(-14), decidedAt: ts(-13),
    });

    // If the user itself acts as an investor, request their startup data room
    await b.set(db.doc(`dataRoomRequests/seed_dr_req_self_${u.uid}`), {
      id: `seed_dr_req_self_${u.uid}`, startupId: `seed_startup_01_seed_user_founder`, founderId: "seed_user_founder", startupName: "KrishiMitra AI",
      investorUid: u.uid, investorName: u.name,
      message: `Requesting files for review on behalf of ${u.name}.`,
      status: "approved", decidedBy: "seed_user_founder",
      createdAt: ts(-5), decidedAt: ts(-4),
    });

    // ── Deal Entries ──
    await b.set(db.doc(`dealEntries/${deal1}`), {
      id: deal1, startupId: startup1, startupName: `KrishiMitra AI`,
      founderId: u.uid, investorUid: "seed_user_investor", investorName: "Sanjay Ghosh",
      stage: "diligence", notes: "Reviewing agronomy results. Tech discussion scheduled.",
      createdBy: "seed_user_investor", createdAt: ts(-10), updatedAt: ts(-3),
    });

    // If the user itself acts as an investor, seed a deal tracking a startup
    await b.set(db.doc(`dealEntries/seed_deal_self_${u.uid}`), {
      id: `seed_deal_self_${u.uid}`, startupId: `seed_startup_01_seed_user_founder`, startupName: "KrishiMitra AI",
      founderId: "seed_user_founder", investorUid: u.uid, investorName: u.name,
      stage: "interest", notes: `Under consideration by ${u.name}.`,
      createdBy: u.uid, createdAt: ts(-5), updatedAt: ts(-3),
    });

    // ── Adopter Profile (Singleton per user uid) ──
    // Seeding this under the user's actual UID so that when they test as an adopter, they have a profile
    await b.set(db.doc(`adopters/${u.uid}`), {
      id: u.uid, uid: u.uid, name: u.name,
      location: "Singapore",
      sectorExpertise: ["SaaS", "B2B sales", "Go-to-market"],
      languages: ["Bengali", "English", "Hindi"],
      availability: "4-6 hours/month",
      contributionModes: ["mentor", "sales_champion", "market_access"],
      createdAt: ts(-20), updatedAt: ts(-5),
    });

    // ── Adoption Requests ──
    await b.set(db.doc(`adoptionRequests/${adoptionReq}`), {
      id: adoptionReq, startupId: startup1, founderId: u.uid, startupName: `KrishiMitra AI`,
      adopterUid: "seed_user_adopter", adopterName: "Arjun Dasgupta",
      modes: ["mentor", "sales_champion"],
      message: "Agri-SaaS advisory request.",
      status: "accepted", createdAt: ts(-15), decidedAt: ts(-13),
    });

    // If the user itself acts as an adopter, request to adopt seed founder's startup
    await b.set(db.doc(`adoptionRequests/seed_adoption_req_self_${u.uid}`), {
      id: `seed_adoption_req_self_${u.uid}`, startupId: `seed_startup_01_seed_user_founder`, founderId: "seed_user_founder", startupName: "KrishiMitra AI",
      adopterUid: u.uid, adopterName: u.name,
      modes: ["mentor"],
      message: `Hi Priya, I can help scale your computer vision team. - ${u.name}`,
      status: "accepted", createdAt: ts(-10), decidedAt: ts(-8),
    });

    // ── Adoption Workspaces ──
    await b.set(db.doc(`adoptionWorkspaces/${adoptionWs}`), {
      id: adoptionWs, startupId: startup1, founderId: u.uid, startupName: `KrishiMitra AI`,
      adopterUid: "seed_user_adopter", adopterName: "Arjun Dasgupta",
      modes: ["mentor", "sales_champion"],
      goals: "Repeatable B2B advisory sales pipeline target.",
      commitments: "Bi-weekly sync calls.",
      impact: {
        mentorHours: 12, salesLeads: 3, meetings: 5, fundsCommittedLakh: 0, introductions: 5, docsReviewed: 4,
      },
      createdAt: ts(-13), updatedAt: ts(-2),
    });

    // If the user itself acts as an adopter, seed workspace with seed founder's startup
    await b.set(db.doc(`adoptionWorkspaces/seed_startup_01_seed_user_founder_${u.uid}`), {
      id: `seed_startup_01_seed_user_founder_${u.uid}`, startupId: `seed_startup_01_seed_user_founder`, founderId: "seed_user_founder", startupName: "KrishiMitra AI",
      adopterUid: u.uid, adopterName: u.name,
      modes: ["mentor"],
      goals: "Establish machine learning architecture roadmap.",
      commitments: "Architecture reviews and mentor syncs.",
      impact: {
        mentorHours: 6, salesLeads: 1, meetings: 2, fundsCommittedLakh: 0, introductions: 2, docsReviewed: 3,
      },
      createdAt: ts(-8), updatedAt: ts(-2),
    });

    // ── Duplicate Candidates ──
    await b.set(db.doc(`duplicateCandidates/seed_dup_${u.uid}`), {
      id: `seed_dup_${u.uid}`, subject: "organisation", recordType: "startups",
      recordIdA: startup1, recordIdB: startup2,
      labelA: `KrishiMitra AI`, labelB: `FinBridge Bengal`,
      matchReason: "Same founder, similar sector keywords",
      matchedOn: ["founderId", "sector_overlap"],
      status: "open", detectedBy: "system", reviewedBy: "seed_user_admin",
      createdAt: ts(-5), updatedAt: ts(-3),
    });
  }

  // ── Global Pitch Events ──
  // We add all users' startups and investor UIDs to this global summit so all users can view/participate.
  const shortlistStartupIds = allUsers.map((u) => `seed_startup_01_${u.uid}`);
  const shortlistFounderIds = allUsers.map((u) => u.uid);
  const investorUids = allUsers.map((u) => u.uid);

  await b.set(db.doc("pitchEvents/seed_pitch_event_01"), {
    id: "seed_pitch_event_01", title: "Bengal Angel Summit 2025",
    description: "Annual pitch event connecting Bengal's most promising startups with angel investors. 10-minute pitches followed by Q&A.",
    at: ts(14), status: "open",
    investorUids,
    shortlistStartupIds,
    shortlistFounderIds,
    createdBy: "seed_user_admin", createdAt: ts(-7), updatedAt: ts(-3),
  });

  // Seed pitch feedback for every user acting as investor
  for (const u of allUsers) {
    await b.set(db.doc(`pitchEvents/seed_pitch_event_01/feedback/${u.uid}`), {
      investorUid: u.uid, investorName: u.name,
      startupId: `seed_startup_01_${u.uid}`,
      note: "Highly scalability demonstrated. Keen to schedule deep dive term sheet call.",
      at: ts(-1),
    });
  }

  const total = await b.flush();
  console.log(`✅ Seeded ${total} documents across all collections.`);
}

// ── REVERT ───────────────────────────────────────────────────────────────────

const ALL_COLLECTIONS = [
  "users", "masters", "cohorts", "startups", "applications",
  "tickets", "meetings", "documents", "courses", "enrollments",
  "directory", "graduations", "consents",
  "crmContacts", "crmOpportunities", "financeEntries",
  "opsConfig", "opsSummary", "ipCases", "campaigns",
  "ndaAgreements", "investors", "startupInvestorProfiles",
  "dataRoomRequests", "pitchEvents", "dealEntries",
  "adopters", "adoptionRequests", "adoptionWorkspaces",
  "duplicateCandidates",
];

// Subcollections: parent collection → subcollection name
const SUBCOLLECTIONS: Record<string, string[]> = {
  startups: ["kpiSnapshots"],
  applications: ["scores", "review"],
  pitchEvents: ["feedback"],
};

async function revert() {
  const b = new BatchWriter();

  // Delete subcollection docs first
  for (const [parent, subs] of Object.entries(SUBCOLLECTIONS)) {
    const parentSnap = await db.collection(parent).get();
    for (const parentDoc of parentSnap.docs) {
      for (const sub of subs) {
        const subSnap = await parentDoc.ref.collection(sub).get();
        for (const subDoc of subSnap.docs) {
          if (subDoc.data().seeded === true || subDoc.id.startsWith("seed_")) {
            await b.delete(subDoc.ref);
          }
        }
      }
    }
  }

  // Delete top-level docs
  for (const col of ALL_COLLECTIONS) {
    const snap = await db.collection(col).get();
    for (const doc of snap.docs) {
      if (doc.data().seeded === true || doc.id.startsWith("seed_")) {
        // Do not delete real user accounts entirely, just exclude real user docs in 'users'
        if (col === "users" && !doc.id.startsWith("seed_")) {
          continue;
        }
        await b.delete(doc.ref);
      }
    }
  }

  const total = await b.flush();
  console.log(`🗑️  Reverted ${total} seeded documents.`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    if (REVERT) {
      await revert();
    } else {
      await seed();
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
