#!/usr/bin/env npx tsx
/**
 * Firestore seed / revert script for all platform features.
 *
 * Usage:
 *   npm run seed          # populate all collections
 *   npm run seed:revert   # delete only seed_* documents
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key,
 * or Application Default Credentials (gcloud auth application-default login).
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

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
    this.batch.set(ref, data);
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

// ── IDs ──────────────────────────────────────────────────────────────────────

const IDS = {
  // Users
  admin: "seed_user_admin",
  cm: "seed_user_cm",
  founder: "seed_user_founder",
  investor: "seed_user_investor",
  evaluator: "seed_user_evaluator",
  adopter: "seed_user_adopter",

  // Startups
  startup1: "seed_startup_01",
  startup2: "seed_startup_02",

  // Cohorts
  cohort1: "seed_cohort_01",
  cohort2: "seed_cohort_02",

  // Applications
  app1: "seed_app_01",
  app2: "seed_app_02",

  // Tickets
  ticketService: "seed_ticket_service",
  ticketHelpdesk: "seed_ticket_helpdesk",
  ticketIp: "seed_ticket_ip",

  // Meetings
  meetingMentor: "seed_meeting_mentor",
  meetingFablab: "seed_meeting_fablab",

  // Documents
  doc1: "seed_doc_01",
  doc2: "seed_doc_02",

  // Courses
  course1: "seed_course_01",
  course2: "seed_course_02",

  // Enrollments
  enrollment1: "seed_enrollment_01",
  enrollment2: "seed_enrollment_02",

  // Directory
  dirMentor: "seed_dir_mentor",
  dirFablab: "seed_dir_fablab",
  dirProvider: "seed_dir_provider",

  // Graduation
  graduation1: "seed_graduation_01",

  // Consents
  consent1: "seed_consent_01",
  consent2: "seed_consent_02",

  // CRM
  contact1: "seed_crm_contact_01",
  contact2: "seed_crm_contact_02",
  contact3: "seed_crm_contact_03",
  opp1: "seed_crm_opp_01",
  opp2: "seed_crm_opp_02",

  // Finance
  fin1: "seed_finance_01",
  fin2: "seed_finance_02",
  fin3: "seed_finance_03",

  // Ops
  opsConfig1: "seed_startup_01", // id == startupId
  opsSummary1: "seed_startup_01",

  // IP
  ipCase1: "seed_ticket_ip", // id == ticketId

  // Campaigns
  campaign1: "seed_campaign_01",

  // NDA
  nda1: "seed_nda_01",

  // Investor
  investorProfile: "seed_user_investor",
  startupInvProfile: "seed_startup_01",

  // Data room
  drReq1: "seed_dr_req_01",

  // Pitch events
  pitchEvent1: "seed_pitch_event_01",

  // Deals
  deal1: "seed_deal_01",

  // Adoption
  adopterProfile: "seed_user_adopter",
  adoptionReq1: "seed_adoption_req_01",
  adoptionWs1: "seed_startup_01_seed_user_adopter",

  // Duplicates
  dup1: "seed_dup_01",
};

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

  // ── Users ──
  const userBase = { approvalStatus: "approved", createdAt: ts(-30), updatedAt: now };
  await b.set(db.doc(`users/${IDS.admin}`), {
    uid: IDS.admin, email: "ananya.sen@example.com", name: "Ananya Sen", phone: "+919800000001",
    role: "admin", ...userBase,
  });
  await b.set(db.doc(`users/${IDS.cm}`), {
    uid: IDS.cm, email: "rajeev.dutta@example.com", name: "Rajeev Dutta", phone: "+919800000002",
    role: "cohort_manager", ...userBase,
  });
  await b.set(db.doc(`users/${IDS.founder}`), {
    uid: IDS.founder, email: "priya.banerjee@example.com", name: "Priya Banerjee", phone: "+919800000003",
    role: "founder", registrationNote: "Building an AI-powered crop advisory for eastern India", ...userBase,
  });
  await b.set(db.doc(`users/${IDS.investor}`), {
    uid: IDS.investor, email: "sanjay.ghosh@example.com", name: "Sanjay Ghosh", phone: "+919800000004",
    role: "investor", identityStatus: "verified", identityVerifiedBy: IDS.admin, identityVerifiedAt: ts(-20),
    registrationNote: "Angel investor focused on deep tech and agri-tech in eastern India", ...userBase,
  });
  await b.set(db.doc(`users/${IDS.evaluator}`), {
    uid: IDS.evaluator, email: "meera.roy@example.com", name: "Meera Roy", phone: "+919800000005",
    role: "evaluator", ...userBase,
  });
  await b.set(db.doc(`users/${IDS.adopter}`), {
    uid: IDS.adopter, email: "arjun.dasgupta@example.com", name: "Arjun Dasgupta", phone: "+919800000006",
    role: "probasi_adopter", identityStatus: "verified", identityVerifiedBy: IDS.admin, identityVerifiedAt: ts(-18),
    registrationNote: "Based in Singapore, deep expertise in SaaS go-to-market strategy", ...userBase,
  });

  // ── Masters ──
  for (const m of MASTER_ENTRIES) {
    await b.set(db.doc(`masters/${m.id}`), {
      id: m.id, type: m.type, label: m.label, order: m.order, active: true, createdAt: ts(-60), updatedAt: ts(-60),
    });
  }

  // ── Cohorts ──
  await b.set(db.doc(`cohorts/${IDS.cohort1}`), {
    id: IDS.cohort1, name: "Bengal Launchpad 2025 — Deep Tech", sectorFocus: ["Deep Tech / AI", "Agri-Tech"],
    eligibilityRules: "Registered in West Bengal, pre-Series A, DPIIT recognised or applied",
    scoringRubric: "Innovation (30), Market (25), Team (25), Traction (20)",
    capacity: 20, selectedCount: 1,
    applicationOpenAt: ts(-60), applicationCloseAt: ts(-30),
    status: "closed", createdBy: IDS.cm, createdAt: ts(-90), updatedAt: ts(-30),
  });
  await b.set(db.doc(`cohorts/${IDS.cohort2}`), {
    id: IDS.cohort2, name: "Green Bengal 2026 — ClimateTech", sectorFocus: ["Agri-Tech"],
    eligibilityRules: "Climate / sustainability focus, pre-revenue or early revenue",
    scoringRubric: "Impact (30), Scalability (25), Team (25), Innovation (20)",
    capacity: 15, selectedCount: 0,
    applicationOpenAt: ts(-5), applicationCloseAt: ts(30),
    status: "open", createdBy: IDS.admin, createdAt: ts(-10), updatedAt: ts(-5),
  });

  // ── Startups ──
  await b.set(db.doc(`startups/${IDS.startup1}`), {
    id: IDS.startup1, founderId: IDS.founder, name: "KrishiMitra AI",
    sector: "Agri-Tech", district: "Kolkata", stage: "Revenue",
    description: "AI-powered crop health advisory & yield prediction platform for smallholder farmers in eastern India. Uses satellite imagery and on-ground IoT sensors for real-time monitoring.",
    teamMembers: [], teamMemberUids: [],
    incubation: {
      cohortId: IDS.cohort1, cohortName: "Bengal Launchpad 2025 — Deep Tech",
      applicationId: IDS.app1,
      onboarding: { acceptedOffer: true, consentGiven: true, baselineKpiCaptured: true, orientationComplete: true, founderVerified: true },
    },
    createdAt: ts(-90), updatedAt: now,
  });
  await b.set(db.doc(`startups/${IDS.startup2}`), {
    id: IDS.startup2, founderId: IDS.founder, name: "FinBridge Bengal",
    sector: "FinTech", district: "Howrah", stage: "Prototype",
    description: "Digital credit platform connecting micro-enterprises in tier-2 Bengal cities with NBFC lending partners via a single KYC flow.",
    teamMembers: [], teamMemberUids: [],
    createdAt: ts(-40), updatedAt: ts(-5),
  });

  // ── KPI Snapshots (subcollection of startup1) ──
  await b.set(db.doc(`startups/${IDS.startup1}/kpiSnapshots/seed_kpi_01`), {
    id: "seed_kpi_01", capturedAt: ts(-80), revenueBand: "0–1L", customers: 12, teamSize: 3, fundsRaised: 0,
    notes: "Baseline at cohort entry", isBaseline: true,
  });
  await b.set(db.doc(`startups/${IDS.startup1}/kpiSnapshots/seed_kpi_02`), {
    id: "seed_kpi_02", capturedAt: ts(-50), revenueBand: "1–5L", customers: 85, teamSize: 5, fundsRaised: 500000,
    notes: "Q1 progress — pilot with 3 FPOs", isBaseline: false,
  });
  await b.set(db.doc(`startups/${IDS.startup1}/kpiSnapshots/seed_kpi_03`), {
    id: "seed_kpi_03", capturedAt: ts(-10), revenueBand: "5–10L", customers: 340, teamSize: 7, fundsRaised: 2500000,
    notes: "Q2 — strong product-market fit among rice & jute farmers", isBaseline: false,
  });

  // ── Applications ──
  await b.set(db.doc(`applications/${IDS.app1}`), {
    id: IDS.app1, cohortId: IDS.cohort1, cohortName: "Bengal Launchpad 2025 — Deep Tech",
    founderId: IDS.founder, startupId: IDS.startup1, startupName: "KrishiMitra AI",
    sector: "Agri-Tech", district: "Kolkata", stage: "Revenue",
    pitchSummary: "AI crop advisory serving 300+ farmers with 92% prediction accuracy on pest detection. Seeking incubation support for scaling to 10,000 farmers across West Bengal.",
    documentUrls: [], status: "selected", isComplete: true, isEligible: true,
    evaluatorIds: [IDS.evaluator],
    committeeDecision: { decision: "selected", decidedAt: ts(-35), locked: true },
    submittedAt: ts(-55), createdAt: ts(-60), updatedAt: ts(-35),
  });
  await b.set(db.doc(`applications/${IDS.app2}`), {
    id: IDS.app2, cohortId: IDS.cohort2, cohortName: "Green Bengal 2026 — ClimateTech",
    founderId: IDS.founder, startupId: IDS.startup2, startupName: "FinBridge Bengal",
    sector: "FinTech", district: "Howrah", stage: "Prototype",
    pitchSummary: "Digital credit scoring for unbanked micro-enterprises using UPI transaction & GST filing data. 15 NBFC partners in pipeline.",
    documentUrls: [], status: "submitted", isComplete: true, isEligible: null,
    evaluatorIds: [IDS.evaluator],
    submittedAt: ts(-3), createdAt: ts(-5), updatedAt: ts(-3),
  });

  // ── Application scores (subcollection) ──
  await b.set(db.doc(`applications/${IDS.app1}/scores/${IDS.evaluator}`), {
    evaluatorId: IDS.evaluator, score: 88, comments: "Excellent traction with clear unit economics. Strong team with domain expertise. Recommend selection.",
    conflictOfInterest: false, submittedAt: ts(-40),
  });
  await b.set(db.doc(`applications/${IDS.app2}/scores/${IDS.evaluator}`), {
    evaluatorId: IDS.evaluator, score: 72, comments: "Interesting approach to MSME credit. Prototype is functional but needs more field validation. Team is capable.",
    conflictOfInterest: false, submittedAt: ts(-1),
  });

  // ── Application review (subcollection) ──
  await b.set(db.doc(`applications/${IDS.app1}/review/decision`), {
    decidedBy: IDS.cm, notes: "Strong consensus from all evaluators. Top scorer in the cohort.", decidedAt: ts(-35),
  });

  // ── Tickets ──
  await b.set(db.doc(`tickets/${IDS.ticketService}`), {
    id: IDS.ticketService, kind: "service", title: "Company registration (Section 8)",
    category: "Legal", urgency: "medium", requiredOutcome: "Complete Section 8 registration with MCA",
    requesterId: IDS.founder, requesterName: "Priya Banerjee", startupId: IDS.startup1,
    providerId: IDS.dirProvider, providerName: "Bengal Legal Associates",
    status: "in_progress",
    notes: [{ authorId: IDS.founder, authorName: "Priya Banerjee", body: "Need help with Section 8 company registration for our non-profit arm.", at: ts(-15) }],
    attachments: [], createdAt: ts(-15), updatedAt: ts(-10),
  });
  await b.set(db.doc(`tickets/${IDS.ticketHelpdesk}`), {
    id: IDS.ticketHelpdesk, kind: "helpdesk", title: "Unable to upload pitch deck",
    category: "Platform support", urgency: "low", requiredOutcome: "Fix file upload issue",
    requesterId: IDS.founder, requesterName: "Priya Banerjee",
    status: "resolved",
    notes: [
      { authorId: IDS.founder, authorName: "Priya Banerjee", body: "Getting a 413 error when uploading my pitch deck PDF (12 MB).", at: ts(-20) },
      { authorId: IDS.admin, authorName: "Ananya Sen", body: "File size limit increased to 25 MB. Please try again.", at: ts(-19) },
    ],
    attachments: [], completionEvidence: "Upload limit increased", rating: 5, ratingComment: "Quick resolution, thank you!",
    createdAt: ts(-20), updatedAt: ts(-18),
  });
  await b.set(db.doc(`tickets/${IDS.ticketIp}`), {
    id: IDS.ticketIp, kind: "ip", title: "Patent filing — crop disease detection algorithm",
    category: "Patent", urgency: "high", requiredOutcome: "File provisional patent application with IPO",
    requesterId: IDS.founder, requesterName: "Priya Banerjee", startupId: IDS.startup1,
    status: "assigned",
    notes: [{ authorId: IDS.founder, authorName: "Priya Banerjee", body: "Our ML model for real-time pest detection is novel. Need patent protection before publishing.", at: ts(-8) }],
    attachments: [], createdAt: ts(-8), updatedAt: ts(-6),
  });

  // ── Meetings ──
  await b.set(db.doc(`meetings/${IDS.meetingMentor}`), {
    id: IDS.meetingMentor, kind: "mentor",
    requesterId: IDS.founder, requesterName: "Priya Banerjee", startupId: IDS.startup1,
    hostId: IDS.dirMentor, hostName: "Dr. Sunil Chatterjee",
    topic: "Go-to-market strategy for FPO partnerships",
    proposedAt: ts(-12), scheduledAt: ts(-8), status: "completed",
    notes: "Discussed channel strategy for reaching farmer producer organisations. Suggested partnering with NABARD-backed FPOs first.",
    actionItems: "1. Draft FPO partnership proposal. 2. Reach out to 5 FPOs in Burdwan district.",
    followUpTasks: "Schedule follow-up in 2 weeks to review proposals.",
    durationMinutes: 45, rating: 5,
    createdAt: ts(-12), updatedAt: ts(-8),
  });
  await b.set(db.doc(`meetings/${IDS.meetingFablab}`), {
    id: IDS.meetingFablab, kind: "fablab",
    requesterId: IDS.founder, requesterName: "Priya Banerjee", startupId: IDS.startup1,
    hostId: IDS.dirFablab, hostName: "TIG Innovation Lab",
    resourceId: IDS.dirFablab, resourceName: "TIG Innovation Lab",
    topic: "IoT sensor prototype assembly session",
    proposedAt: ts(-5), scheduledAt: ts(2), status: "scheduled",
    createdAt: ts(-5), updatedAt: ts(-3),
  });

  // ── Documents ──
  await b.set(db.doc(`documents/${IDS.doc1}`), {
    id: IDS.doc1, ownerType: "startup", ownerId: IDS.startup1,
    category: "Pitch deck", title: "KrishiMitra AI — Pitch Deck Q2 2025",
    version: 2, storagePath: "startups/seed_startup_01/pitch_deck_v2.pdf",
    downloadUrl: "https://example.com/placeholder.pdf",
    uploadedBy: IDS.founder, visibleTo: [IDS.investor],
    createdAt: ts(-20),
  });
  await b.set(db.doc(`documents/${IDS.doc2}`), {
    id: IDS.doc2, ownerType: "startup", ownerId: IDS.startup1,
    category: "Financial", title: "KrishiMitra AI — P&L Statement FY24-25",
    version: 1, storagePath: "startups/seed_startup_01/pl_fy2425.pdf",
    downloadUrl: "https://example.com/placeholder2.pdf",
    uploadedBy: IDS.founder, visibleTo: [],
    createdAt: ts(-10),
  });

  // ── Courses ──
  await b.set(db.doc(`courses/${IDS.course1}`), {
    id: IDS.course1, title: "Startup Fundamentals — Business Model Canvas", description: "Mandatory training on lean startup methodology, value proposition design, and business model iteration for all cohort founders.",
    track: "mandatory", sessions: [
      { id: "seed_session_1a", title: "Introduction to Lean Canvas", scheduledAt: ts(-70) },
      { id: "seed_session_1b", title: "Customer Discovery Workshop", scheduledAt: ts(-63) },
      { id: "seed_session_1c", title: "Revenue Model Design", scheduledAt: ts(-56) },
    ],
    active: true, createdBy: IDS.cm, createdAt: ts(-80), updatedAt: ts(-56),
  });
  await b.set(db.doc(`courses/${IDS.course2}`), {
    id: IDS.course2, title: "Investor Readiness — Pitch Mastery", description: "Elective course on crafting compelling investor narratives, financial modelling for fundraise, and pitch delivery technique.",
    track: "investor_readiness", sessions: [
      { id: "seed_session_2a", title: "The 10-Slide Pitch Framework", scheduledAt: ts(-40) },
      { id: "seed_session_2b", title: "Financial Modelling for Seed Stage", scheduledAt: ts(-33) },
    ],
    active: true, createdBy: IDS.cm, createdAt: ts(-50), updatedAt: ts(-33),
  });

  // ── Enrollments ──
  await b.set(db.doc(`enrollments/${IDS.enrollment1}`), {
    id: IDS.enrollment1, courseId: IDS.course1, courseTitle: "Startup Fundamentals — Business Model Canvas",
    track: "mandatory", startupId: IDS.startup1, founderId: IDS.founder,
    attendedSessionIds: ["seed_session_1a", "seed_session_1b", "seed_session_1c"],
    assessmentScore: 85, status: "completed",
    feedback: "Priya demonstrated strong understanding of customer segments and revenue models. Excellent participation.",
    enrolledAt: ts(-75), updatedAt: ts(-50), completedAt: ts(-50),
  });
  await b.set(db.doc(`enrollments/${IDS.enrollment2}`), {
    id: IDS.enrollment2, courseId: IDS.course2, courseTitle: "Investor Readiness — Pitch Mastery",
    track: "investor_readiness", startupId: IDS.startup1, founderId: IDS.founder,
    attendedSessionIds: ["seed_session_2a"],
    status: "in_progress",
    enrolledAt: ts(-42), updatedAt: ts(-33),
  });

  // ── Directory ──
  await b.set(db.doc(`directory/${IDS.dirMentor}`), {
    id: IDS.dirMentor, kind: "mentor", name: "Dr. Sunil Chatterjee",
    category: "Business strategy", description: "20+ years experience in agribusiness strategy. Former VP at ITC Agri Business. Mentor at NSRCEL and TIG AIC.",
    location: "Kolkata", languages: ["Bengali", "Hindi", "English"],
    expertise: ["Go-to-market strategy", "Agribusiness", "B2B sales", "Channel partnerships"],
    equipment: [], services: [],
    active: true, createdBy: IDS.admin, createdAt: ts(-100), updatedAt: ts(-50),
  });
  await b.set(db.doc(`directory/${IDS.dirFablab}`), {
    id: IDS.dirFablab, kind: "fablab", name: "TIG Innovation Lab",
    category: "IoT & Electronics", description: "Full-service prototyping lab with PCB fabrication, 3D printing, CNC machining, and IoT sensor assembly stations.",
    location: "Salt Lake, Kolkata", languages: ["English", "Bengali"],
    expertise: [], equipment: [
      { name: "3D Printer (Prusa MK4)", safetyPrereq: "Basic 3D printing orientation" },
      { name: "PCB Mill (Bantam Tools)", safetyPrereq: "Electronics safety certification" },
      { name: "Soldering Station" },
      { name: "IoT Sensor Kit (Arduino / Raspberry Pi)" },
    ],
    services: [],
    active: true, createdBy: IDS.admin, createdAt: ts(-100), updatedAt: ts(-60),
  });
  await b.set(db.doc(`directory/${IDS.dirProvider}`), {
    id: IDS.dirProvider, kind: "provider", name: "Bengal Legal Associates",
    category: "Legal", description: "Corporate law firm specialising in startup incorporation, IP filing, and regulatory compliance in West Bengal.",
    location: "Park Street, Kolkata", languages: ["English", "Bengali", "Hindi"],
    expertise: [], equipment: [],
    services: ["Company registration", "Trademark filing", "Patent applications", "DPIIT recognition", "FSSAI licensing"],
    sla: "5 business days for initial consultation",
    active: true, createdBy: IDS.admin, createdAt: ts(-100), updatedAt: ts(-80),
  });

  // ── Graduations ──
  await b.set(db.doc(`graduations/${IDS.graduation1}`), {
    id: IDS.graduation1, startupId: IDS.startup1, startupName: "KrishiMitra AI",
    cohortId: IDS.cohort1, founderId: IDS.founder,
    criteria: [
      { key: "training", label: "Mandatory training completed", met: true },
      { key: "milestones", label: "Milestones achieved", met: true },
      { key: "kpis", label: "KPI targets met", met: true },
      { key: "compliance", label: "Compliance & documents in order", met: true },
      { key: "investor_ready", label: "Investor-readiness materials ready", met: false },
    ],
    score: 80, decision: "graduated", decidedBy: IDS.cm, decidedAt: ts(-2),
    createdAt: ts(-10), updatedAt: ts(-2),
  });

  // ── Consents ──
  await b.set(db.doc(`consents/${IDS.consent1}`), {
    id: IDS.consent1, startupId: IDS.startup1, founderId: IDS.founder,
    contactId: IDS.contact1, contactEmail: "rajesh.kumar@example.com",
    purpose: "outreach", granted: true, source: "In-app consent form",
    grantedAt: ts(-15), updatedAt: ts(-15),
  });
  await b.set(db.doc(`consents/${IDS.consent2}`), {
    id: IDS.consent2, startupId: IDS.startup1, founderId: IDS.founder,
    contactId: IDS.contact2, contactEmail: "neha.sharma@example.com",
    purpose: "data_sharing", granted: true, source: "Email confirmation",
    grantedAt: ts(-12), updatedAt: ts(-12),
  });

  // ── CRM Contacts ──
  await b.set(db.doc(`crmContacts/${IDS.contact1}`), {
    id: IDS.contact1, startupId: IDS.startup1, founderId: IDS.founder,
    name: "Rajesh Kumar", email: "rajesh.kumar@example.com", company: "Burdwan Farmers Cooperative",
    contributedByUid: IDS.founder, contributedByName: "Priya Banerjee",
    createdAt: ts(-20), updatedAt: ts(-15),
  });
  await b.set(db.doc(`crmContacts/${IDS.contact2}`), {
    id: IDS.contact2, startupId: IDS.startup1, founderId: IDS.founder,
    name: "Neha Sharma", email: "neha.sharma@example.com", company: "AgriNext Ventures",
    createdAt: ts(-18), updatedAt: ts(-12),
  });
  await b.set(db.doc(`crmContacts/${IDS.contact3}`), {
    id: IDS.contact3, startupId: IDS.startup1, founderId: IDS.founder,
    name: "Amit Patel", email: "amit.patel@example.com", company: "NABARD Regional Office",
    contributedByUid: IDS.dirMentor, contributedByName: "Dr. Sunil Chatterjee",
    createdAt: ts(-10), updatedAt: ts(-10),
  });

  // ── CRM Opportunities ──
  await b.set(db.doc(`crmOpportunities/${IDS.opp1}`), {
    id: IDS.opp1, startupId: IDS.startup1, founderId: IDS.founder,
    contactId: IDS.contact1, title: "Burdwan FPO — pilot deployment (50 sensors)",
    stage: "proposal", value: 350000, notes: "Proposal submitted for 50-sensor deployment across 3 villages. Decision expected this month.",
    createdAt: ts(-18), updatedAt: ts(-5),
  });
  await b.set(db.doc(`crmOpportunities/${IDS.opp2}`), {
    id: IDS.opp2, startupId: IDS.startup1, founderId: IDS.founder,
    contactId: IDS.contact2, title: "AgriNext Ventures — strategic partnership",
    stage: "qualified", value: 1500000, notes: "Exploring distribution partnership for their network of 200 FPOs across Bengal and Odisha.",
    createdAt: ts(-12), updatedAt: ts(-8),
  });

  // ── Finance Entries ──
  await b.set(db.doc(`financeEntries/${IDS.fin1}`), {
    id: IDS.fin1, startupId: IDS.startup1, founderId: IDS.founder,
    kind: "invoice", description: "Pilot deployment — Burdwan FPO (advance 50%)",
    amount: 175000, paid: true, occurredAt: ts(-15), createdAt: ts(-15),
  });
  await b.set(db.doc(`financeEntries/${IDS.fin2}`), {
    id: IDS.fin2, startupId: IDS.startup1, founderId: IDS.founder,
    kind: "invoice", description: "SaaS subscription — 85 farmers (monthly)",
    amount: 42500, paid: false, occurredAt: ts(-5), createdAt: ts(-5),
  });
  await b.set(db.doc(`financeEntries/${IDS.fin3}`), {
    id: IDS.fin3, startupId: IDS.startup1, founderId: IDS.founder,
    kind: "expense", description: "IoT sensor components (batch of 100)",
    amount: 120000, occurredAt: ts(-12), createdAt: ts(-12),
  });

  // ── Ops Config ──
  await b.set(db.doc(`opsConfig/${IDS.opsConfig1}`), {
    id: IDS.opsConfig1, startupId: IDS.startup1, founderId: IDS.founder,
    crmMode: "built_in", financeMode: "built_in",
    updatedAt: ts(-20),
  });

  // ── Ops Summary ──
  await b.set(db.doc(`opsSummary/${IDS.opsSummary1}`), {
    id: IDS.opsSummary1, startupId: IDS.startup1, founderId: IDS.founder, startupName: "KrishiMitra AI",
    pipelineValue: 1850000, openOpportunities: 2, wonOpportunities: 0, wonValue: 0,
    invoicedTotal: 217500, expenseTotal: 120000, cashPosition: 97500,
    outreachSent: 45, outreachResponses: 12, outreachConversions: 3, outreachSalesValue: 350000,
    adoptionMentorHours: 12, adoptionSalesLeads: 3, adoptionFundsCommittedLakh: 0, adoptionIntroductions: 5,
    updatedAt: now,
  });

  // ── IP Cases ──
  await b.set(db.doc(`ipCases/${IDS.ipCase1}`), {
    id: IDS.ipCase1, ticketId: IDS.ticketIp, startupId: IDS.startup1, founderId: IDS.founder,
    ipType: "patent", feeCredits: 25000,
    createdAt: ts(-8), updatedAt: ts(-6),
  });

  // ── Campaigns (Outreach) ──
  await b.set(db.doc(`campaigns/${IDS.campaign1}`), {
    id: IDS.campaign1, startupId: IDS.startup1, founderId: IDS.founder,
    name: "FPO Partnership Outreach — Bengal", channel: "email",
    brief: {
      segment: "Farmer Producer Organisations in West Bengal",
      valueProp: "AI-powered crop advisory that increases yield by 15-20% and reduces pesticide cost by 30%",
      goal: "Schedule demo meetings with FPO managers",
      tone: "Professional but warm",
      language: "English",
    },
    contactIds: [IDS.contact1, IDS.contact3],
    draft: "Dear [Name],\n\nI'm writing from KrishiMitra AI — we help farmer producer organisations improve crop yields using satellite imagery and IoT-based advisories.\n\nOur pilot with Burdwan FPO showed a 17% yield increase in the rabi season. I'd love to schedule a 20-minute demo to show how this could work for your member farmers.\n\nWould next Tuesday or Wednesday work?\n\nWarm regards,\nPriya Banerjee\nFounder, KrishiMitra AI",
    draftModel: "claude-3-haiku",
    includedContactIds: [IDS.contact1],
    excludedContactIds: [IDS.contact3],
    status: "approved", approvedBy: IDS.founder, approvedAt: ts(-10),
    outcome: { sent: 1, responses: 1, meetings: 1, conversions: 0, salesValue: 0, updatedAt: ts(-5) },
    createdAt: ts(-12), updatedAt: ts(-5),
  });

  // ── NDA Agreements ──
  await b.set(db.doc(`ndaAgreements/${IDS.nda1}`), {
    id: IDS.nda1, startupId: IDS.startup1, founderId: IDS.founder,
    templateKey: "mutual", signerUid: IDS.investor, signerName: "Sanjay Ghosh",
    unlocksDocId: IDS.doc2, status: "signed",
    signedDocId: IDS.doc1, createdBy: IDS.founder,
    createdAt: ts(-15), signedAt: ts(-12),
  });

  // ── Investor Profile ──
  await b.set(db.doc(`investors/${IDS.investorProfile}`), {
    id: IDS.investorProfile, uid: IDS.investor, name: "Sanjay Ghosh",
    sectors: ["Deep Tech / AI", "Agri-Tech", "FinTech"],
    ticketMinLakh: 10, ticketMaxLakh: 50,
    geographies: ["West Bengal", "Odisha", "Jharkhand"],
    stagePreferences: ["Prototype", "Revenue"],
    portfolio: "5 active investments in deep-tech and agri-tech startups across eastern India. Notable: FarmStack (Series A, agri logistics), CodeBridge (Seed, developer tools).",
    languages: ["Bengali", "Hindi", "English"],
    engagement: "active",
    createdAt: ts(-25), updatedAt: ts(-5),
  });

  // ── Startup Investor Profile ──
  await b.set(db.doc(`startupInvestorProfiles/${IDS.startupInvProfile}`), {
    id: IDS.startupInvProfile, startupId: IDS.startup1, founderId: IDS.founder, startupName: "KrishiMitra AI",
    pitch: "KrishiMitra AI delivers real-time crop health advisories to 340+ smallholder farmers using satellite imagery and ground-level IoT sensors, achieving 92% pest-detection accuracy.",
    traction: "₹5.5L MRR, 340 paying farmers, 3 FPO partnerships, 17% yield improvement demonstrated in controlled pilot",
    team: "Priya Banerjee (CEO, IIT Kharagpur CS, 4 yrs agri-tech), 2 ML engineers, 1 agronomist, 3 field ops",
    financialSummary: "FY25 revenue ₹8.5L, burn ₹3L/mo, 8 months runway at current burn",
    fundingAskLakh: 100, useOfFunds: "60% engineering (computer vision team expansion), 25% field ops (5 new districts), 15% working capital",
    documentIds: [IDS.doc1, IDS.doc2],
    status: "published", reviewedBy: IDS.cm,
    createdAt: ts(-20), updatedAt: ts(-8),
  });

  // ── Data Room Requests ──
  await b.set(db.doc(`dataRoomRequests/${IDS.drReq1}`), {
    id: IDS.drReq1, startupId: IDS.startup1, founderId: IDS.founder, startupName: "KrishiMitra AI",
    investorUid: IDS.investor, investorName: "Sanjay Ghosh",
    message: "Very interested in KrishiMitra AI. Would like to review the P&L and cap table before scheduling a call.",
    status: "approved", decidedBy: IDS.founder,
    createdAt: ts(-14), decidedAt: ts(-13),
  });

  // ── Pitch Events ──
  await b.set(db.doc(`pitchEvents/${IDS.pitchEvent1}`), {
    id: IDS.pitchEvent1, title: "Bengal Angel Summit 2025",
    description: "Annual pitch event connecting Bengal's most promising deep-tech startups with angel investors from the Probasi network. 10-minute pitches followed by 5-minute Q&A.",
    at: ts(14), status: "open",
    investorUids: [IDS.investor],
    shortlistStartupIds: [IDS.startup1],
    shortlistFounderIds: [IDS.founder],
    createdBy: IDS.admin, createdAt: ts(-7), updatedAt: ts(-3),
  });

  // ── Pitch Feedback (subcollection) ──
  await b.set(db.doc(`pitchEvents/${IDS.pitchEvent1}/feedback/${IDS.investor}`), {
    investorUid: IDS.investor, investorName: "Sanjay Ghosh",
    startupId: IDS.startup1,
    note: "Strong traction and clear product-market fit. Unit economics look promising. Would like to explore a ₹25L cheque at pre-Series A valuation.",
    at: ts(-1),
  });

  // ── Deal Entries ──
  await b.set(db.doc(`dealEntries/${IDS.deal1}`), {
    id: IDS.deal1, startupId: IDS.startup1, startupName: "KrishiMitra AI",
    founderId: IDS.founder, investorUid: IDS.investor, investorName: "Sanjay Ghosh",
    stage: "diligence", notes: "Investor reviewing financials and farmer retention data. Next step: call with the tech team.",
    createdBy: IDS.investor, createdAt: ts(-10), updatedAt: ts(-3),
  });

  // ── Adopter Profile ──
  await b.set(db.doc(`adopters/${IDS.adopterProfile}`), {
    id: IDS.adopterProfile, uid: IDS.adopter, name: "Arjun Dasgupta",
    location: "Singapore",
    sectorExpertise: ["SaaS", "B2B sales", "Go-to-market"],
    languages: ["Bengali", "English", "Hindi"],
    availability: "4-6 hours/month, weekends preferred",
    contributionModes: ["mentor", "sales_champion", "market_access"],
    createdAt: ts(-20), updatedAt: ts(-5),
  });

  // ── Adoption Requests ──
  await b.set(db.doc(`adoptionRequests/${IDS.adoptionReq1}`), {
    id: IDS.adoptionReq1, startupId: IDS.startup1, founderId: IDS.founder, startupName: "KrishiMitra AI",
    adopterUid: IDS.adopter, adopterName: "Arjun Dasgupta",
    modes: ["mentor", "sales_champion"],
    message: "Would love to help KrishiMitra AI with go-to-market strategy for their SaaS offering. I have relevant experience scaling agri-SaaS in Southeast Asia.",
    status: "accepted", createdAt: ts(-15), decidedAt: ts(-13),
  });

  // ── Adoption Workspaces ──
  await b.set(db.doc(`adoptionWorkspaces/${IDS.adoptionWs1}`), {
    id: IDS.adoptionWs1, startupId: IDS.startup1, founderId: IDS.founder, startupName: "KrishiMitra AI",
    adopterUid: IDS.adopter, adopterName: "Arjun Dasgupta",
    modes: ["mentor", "sales_champion"],
    goals: "Help KrishiMitra build a repeatable B2B sales motion targeting FPOs. Introduce to 3 potential distribution partners in Q3.",
    commitments: "2 mentoring calls/month, review sales collateral, warm introductions to network contacts.",
    impact: {
      mentorHours: 12, salesLeads: 3, meetings: 5, fundsCommittedLakh: 0, introductions: 5, docsReviewed: 4,
    },
    createdAt: ts(-13), updatedAt: ts(-2),
  });

  // ── Duplicate Candidates ──
  await b.set(db.doc(`duplicateCandidates/${IDS.dup1}`), {
    id: IDS.dup1, subject: "organisation", recordType: "startups",
    recordIdA: IDS.startup1, recordIdB: IDS.startup2,
    labelA: "KrishiMitra AI", labelB: "FinBridge Bengal",
    matchReason: "Same founder, similar sector keywords",
    matchedOn: ["founderId", "sector_overlap"],
    status: "dismissed", detectedBy: "system", reviewedBy: IDS.admin,
    createdAt: ts(-5), updatedAt: ts(-3),
  });

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
    // Find all seed_* parent docs
    const parentSnap = await db.collection(parent).listDocuments();
    for (const parentDoc of parentSnap) {
      if (!parentDoc.id.startsWith("seed_")) continue;
      for (const sub of subs) {
        const subSnap = await parentDoc.collection(sub).listDocuments();
        for (const subDoc of subSnap) {
          await b.delete(subDoc);
        }
      }
    }
  }

  // Delete top-level seed_* docs
  for (const col of ALL_COLLECTIONS) {
    const snap = await db.collection(col).listDocuments();
    for (const docRef of snap) {
      if (docRef.id.startsWith("seed_")) {
        await b.delete(docRef);
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
