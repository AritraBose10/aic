import type { Timestamp } from "firebase/firestore";

/**
 * Single source of truth for data shapes across every feature.
 * Extend additively — never rewrite a field's meaning once shipped.
 */

export type Role = "admin" | "cohort_manager" | "evaluator" | "founder" | "investor" | "probasi_adopter";

export type ApprovalStatus = "pending" | "approved" | "rejected";

/**
 * Phase 4 — identity verification, a SEPARATE dimension from approvalStatus
 * (which stays as-is). The two new self-service roles (`investor`,
 * `probasi_adopter`) must be admin-verified before any sensitive access is
 * granted; incumbent roles leave this unset.
 */
export type IdentityStatus = "pending_verification" | "verified" | "unverified";

export interface UserDoc {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  approvalStatus: ApprovalStatus;
  /** Phase 4: identity verification for investor / probasi_adopter (unset for incumbent roles). */
  identityStatus?: IdentityStatus;
  identityVerifiedBy?: string;
  identityVerifiedAt?: Timestamp;
  /** Free-text context captured at registration, role-dependent (startup idea, affiliation, org). */
  registrationNote?: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CohortStatus = "draft" | "open" | "closed";

export interface CohortDoc {
  id: string;
  name: string;
  sectorFocus: string[];
  eligibilityRules: string;
  scoringRubric: string;
  capacity: number;
  /** Number of applications selected into this cohort — maintained transactionally to enforce capacity. */
  selectedCount: number;
  applicationOpenAt: Timestamp;
  applicationCloseAt: Timestamp;
  status: CohortStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "interviewed"
  | "selected"
  | "rejected"
  | "waitlisted";

/** Lives at applications/{id}/scores/{evaluatorId} — one doc per evaluator, doc id == evaluatorId. */
export interface ApplicationScoreDoc {
  evaluatorId: string;
  score: number;
  comments: string;
  conflictOfInterest: boolean;
  submittedAt: Timestamp;
}

/** Lives at applications/{id}/review/decision — staff-only read; keeps committee deliberation off the founder-readable app doc. */
export interface CommitteeReviewDoc {
  decidedBy: string;
  notes: string | null;
  decidedAt: Timestamp;
}

export interface ApplicationDoc {
  id: string;
  cohortId: string;
  /** Snapshot, set once at creation — avoids a join for list views. */
  cohortName: string;
  founderId: string;
  startupId: string;
  /** Snapshot of the startup profile at submission time — evaluators see this as of application time, not live. */
  startupName: string;
  sector: string;
  district: string;
  stage: string;
  pitchSummary: string;
  documentUrls: string[];
  status: ApplicationStatus;
  isComplete: boolean;
  isEligible: boolean | null;
  evaluatorIds: string[];
  // Scores live in the scores/{evaluatorId} subcollection, not on this doc —
  // read them with useApplicationScores(applicationId) / useMyScore(...).
  // Public outcome only — the founder can read this. Private deliberation
  // (who decided, internal notes) lives in the staff-only review/decision doc.
  committeeDecision?: {
    decision: "selected" | "rejected" | "waitlisted";
    decidedAt: Timestamp;
    locked: boolean;
  };
  submittedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface KpiSnapshotDoc {
  id: string;
  capturedAt: Timestamp;
  revenueBand: string;
  customers: number;
  teamSize: number;
  fundsRaised: number;
  notes?: string;
  /** Append-only: a new document is written every period, existing snapshots are never edited. */
  isBaseline: boolean;
}

/**
 * Onboarding items. `founderVerified` is the staff-gated item (cohort manager
 * confirms the founder); the rest are completed by the founder. The staff gate
 * is UI-enforced only — Firestore rules let any startup owner or staff write
 * the whole doc, so field-level hardening would be a later pass.
 */
export interface OnboardingChecklist {
  acceptedOffer: boolean;
  consentGiven: boolean;
  baselineKpiCaptured: boolean;
  orientationComplete: boolean;
  founderVerified: boolean;
}

export const ONBOARDING_STEPS: {
  key: keyof OnboardingChecklist;
  label: string;
  owner: "founder" | "staff";
}[] = [
  { key: "acceptedOffer", label: "Accept cohort offer", owner: "founder" },
  { key: "consentGiven", label: "Give data-sharing consent", owner: "founder" },
  { key: "baselineKpiCaptured", label: "Capture baseline KPIs", owner: "founder" },
  { key: "orientationComplete", label: "Complete orientation", owner: "founder" },
  { key: "founderVerified", label: "Founder verified by cohort team", owner: "staff" },
];

/** Present on a StartupDoc once its application is selected into a cohort. */
export interface StartupIncubation {
  cohortId: string;
  cohortName: string;
  applicationId: string;
  onboarding: OnboardingChecklist;
}

export type StartupTeamAccessRole = "co_founder" | "finance" | "sales" | "operations";
export type StartupTeamMemberStatus = "active" | "suspended";

export interface StartupTeamMemberDoc {
  uid: string;
  email: string;
  name: string;
  accessRole: StartupTeamAccessRole;
  status: StartupTeamMemberStatus;
  invitedAt: Timestamp;
}

export interface StartupDoc {
  id: string;
  founderId: string;
  name: string;
  sector: string;
  district: string;
  stage: string;
  description: string;
  /** Full history, including suspended members — for the founder's delegate UI and audit. */
  teamMembers: StartupTeamMemberDoc[];
  /** Denormalized uids with status "active", kept in sync with teamMembers — lets Firestore rules and "my startups" queries do an array-contains check. */
  teamMemberUids: string[];
  /** Set once this startup's application is selected — absent until then. */
  incubation?: StartupIncubation;
  /** Set on graduation (GRD-02) — incubation + KPI history are preserved alongside. */
  alumni?: { graduatedAt: Timestamp; cohortId: string };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AuditAction =
  | "user.register"
  | "user.approve"
  | "user.reject"
  | "user.identity_verify"
  | "user.identity_reject"
  | "cohort.create"
  | "cohort.update"
  | "application.submit"
  | "application.assign_evaluators"
  | "application.score"
  | "application.eligibility"
  | "application.decide"
  | "application.reopen"
  | "startup.create"
  | "startup.update"
  | "startup.team.invite"
  | "startup.team.suspend"
  | "startup.team.reactivate"
  | "startup.onboard.update"
  | "startup.kpi.snapshot"
  // --- Phase 2 ---
  | "master.create"
  | "master.update"
  | "ticket.create"
  | "ticket.update"
  | "meeting.request"
  | "meeting.respond"
  | "meeting.complete"
  | "document.upload"
  | "training.enroll"
  | "training.complete"
  | "graduation.decide"
  // --- Phase 3 ---
  | "consent.grant"
  | "consent.revoke"
  | "crm.lead.create"
  | "crm.opportunity.update"
  | "crm.convert"
  | "finance.record"
  | "ip.case.create"
  | "ip.case.update"
  | "nda.issue"
  | "nda.sign"
  | "ai.generate"
  | "outreach.draft"
  | "outreach.approve"
  | "outreach.send_blocked"
  | "outreach.outcome"
  // --- Phase 4 ---
  | "investor.profile.update"
  | "investor.facing_profile.update"
  | "investor.facing_profile.review"
  | "dataroom.request"
  | "dataroom.decide"
  | "dataroom.access"
  | "pitch.event.update"
  | "deal.stage.update"
  | "adopter.profile.update"
  | "adoption.request"
  | "adoption.decide"
  | "adoption.workspace.update"
  | "acknowledge"
  // --- Hardening ---
  | "duplicate.review"
  | "identity.merge"
  | "user.session_revoke"
  | "user.data_export"
  | "user.deactivate"
  | "retention.cleanup";

export type AuditEntityType =
  | "user"
  | "cohort"
  | "application"
  | "startup"
  | "master"
  | "ticket"
  | "meeting"
  | "document"
  | "course"
  | "graduation"
  // --- Phase 3 ---
  | "consent"
  | "lead"
  | "opportunity"
  | "invoice"
  | "expense"
  | "ipCase"
  | "campaign"
  | "ndaAgreement"
  // --- Phase 4 ---
  | "investorProfile"
  | "startupInvestorProfile"
  | "dataRoomRequest"
  | "pitchEvent"
  | "dealEntry"
  | "adopterProfile"
  | "adoptionRequest"
  | "adoptionWorkspace"
  // --- Hardening ---
  | "duplicateCandidate"
  | "identity";

export interface AuditEventDoc {
  id: string;
  actorId: string;
  actorRole: Role;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  details?: Record<string, unknown>;
  timestamp: Timestamp;
}

// ============================================================================
// Phase 2 — core primitives
// ============================================================================

/** Admin-editable taxonomies (ADM-01). Everything reads from here — no hardcoded lists. */
export type MasterType =
  | "sector"
  | "district"
  | "stage"
  | "serviceCategory"
  | "providerCategory"
  | "trainingTrack"
  | "documentCategory";

export interface MasterEntryDoc {
  id: string;
  type: MasterType;
  label: string;
  order: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Shared ticket primitive (Section 4.1) — services (ECO-02), helpdesk (SUP-01), IP cases (IP-02). */
export type TicketKind = "service" | "helpdesk" | "ip";
export type TicketUrgency = "low" | "medium" | "high";
export type TicketStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "escalated";

export interface TicketNoteDoc {
  authorId: string;
  authorName: string;
  body: string;
  at: Timestamp;
}

export interface TicketDoc {
  id: string;
  kind: TicketKind;
  title: string;
  category: string;
  urgency: TicketUrgency;
  requiredOutcome: string;
  requesterId: string;
  requesterName: string;
  startupId?: string;
  providerId?: string;
  providerName?: string;
  slaDueAt?: Timestamp;
  status: TicketStatus;
  notes: TicketNoteDoc[];
  attachments: string[];
  completionEvidence?: string;
  rating?: number;
  ratingComment?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Generic booking entity — mentors (ECO-03) + fab labs (ECO-04) now, investor/pitch reuse later. */
export type MeetingKind = "mentor" | "fablab";
export type MeetingStatus =
  | "requested"
  | "accepted"
  | "rejected"
  | "scheduled"
  | "completed"
  | "cancelled";

export interface MeetingDoc {
  id: string;
  kind: MeetingKind;
  requesterId: string;
  requesterName: string;
  startupId?: string;
  hostId: string;
  hostName: string;
  resourceId?: string;
  resourceName?: string;
  topic: string;
  proposedAt: Timestamp;
  scheduledAt?: Timestamp;
  status: MeetingStatus;
  notes?: string;
  actionItems?: string;
  followUpTasks?: string;
  durationMinutes?: number;
  rating?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Notification templates (COM-01) + per-entity communication timeline (COM-02). */
export type CommChannel = "email" | "sms" | "in_app";

export interface NotificationTemplateDoc {
  id: string;
  key: string;
  channel: CommChannel;
  subject: string;
  body: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CommunicationEntityType =
  | "user"
  | "startup"
  | "application"
  | "mentor"
  | "provider"
  | "ticket"
  | "meeting";

export interface CommunicationEventDoc {
  id: string;
  entityType: CommunicationEntityType;
  entityId: string;
  templateKey?: string;
  channel: CommChannel;
  subject: string;
  body: string;
  toUserId?: string;
  sentBy: string;
  at: Timestamp;
}

/** Secure document vault (DOC-01) — metadata in Firestore, blobs in Firebase Storage. */
export type DocumentOwnerType = "startup" | "application" | "user" | "cohort" | "course";

export interface DocumentDoc {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  category: string;
  title: string;
  version: number;
  storagePath: string;
  downloadUrl: string;
  uploadedBy: string;
  expiresAt?: Timestamp;
  /** uids granted read access beyond the owner + staff. */
  visibleTo: string[];
  supersededBy?: string;
  createdAt: Timestamp;
}

// ============================================================================
// Phase 2 — features/training (LMS-01/02/03)
// ============================================================================

export type TrainingTrack = "mandatory" | "elective" | "sector" | "investor_readiness";

export const TRAINING_TRACK_LABELS: Record<TrainingTrack, string> = {
  mandatory: "Mandatory",
  elective: "Elective",
  sector: "Sector-specific",
  investor_readiness: "Investor readiness",
};

export interface CourseSession {
  id: string;
  title: string;
  scheduledAt: Timestamp;
}

export interface CourseDoc {
  id: string;
  title: string;
  description: string;
  track: TrainingTrack;
  /** Only meaningful when track === "sector". */
  sector?: string;
  sessions: CourseSession[];
  active: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Phase 2 — features/directory (ECO-01), mentors (ECO-03), fab labs (ECO-04)
// ============================================================================

export type DirectoryKind = "mentor" | "fablab" | "provider";

export const DIRECTORY_KIND_LABELS: Record<DirectoryKind, string> = {
  mentor: "Mentor",
  fablab: "Fab lab",
  provider: "Service provider",
};

export interface FabLabEquipment {
  name: string;
  safetyPrereq?: string;
}

/** Unified ecosystem directory entry — one collection powers ECO-01 search and
 *  backs mentors / fab labs / service providers. */
export interface DirectoryEntryDoc {
  id: string;
  kind: DirectoryKind;
  name: string;
  category: string;
  description: string;
  location?: string;
  languages: string[];
  /** Linked platform user who can host meetings / fulfil tickets, if any. */
  contactUserId?: string;
  contactUserName?: string;
  // mentor
  expertise: string[];
  // fab lab
  equipment: FabLabEquipment[];
  // service provider
  services: string[];
  sla?: string;
  /** A startup acting as a provider to others (ECO-06). */
  startupId?: string;
  active: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Phase 2 — features/graduation (GRD-01/02/03)
// ============================================================================

export interface GraduationCriterion {
  key: string;
  label: string;
  met: boolean;
}

export type GraduationDecision = "graduated" | "not_ready";

/** One doc per startup (id == startupId). */
export interface GraduationDoc {
  id: string;
  startupId: string;
  startupName: string;
  cohortId: string;
  founderId: string;
  criteria: GraduationCriterion[];
  /** Percentage of criteria met (0–100). */
  score: number;
  decision?: GraduationDecision;
  decidedBy?: string;
  decidedAt?: Timestamp;
  certificateDocId?: string;
  outcomeReportDocId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const DEFAULT_GRADUATION_CRITERIA: Omit<GraduationCriterion, "met">[] = [
  { key: "training", label: "Mandatory training completed" },
  { key: "milestones", label: "Milestones achieved" },
  { key: "kpis", label: "KPI targets met" },
  { key: "compliance", label: "Compliance & documents in order" },
  { key: "investor_ready", label: "Investor-readiness materials ready" },
];

export type EnrollmentStatus = "enrolled" | "in_progress" | "completed" | "dropped";

export interface EnrollmentDoc {
  id: string;
  courseId: string;
  courseTitle: string;
  track: TrainingTrack;
  startupId: string;
  founderId: string;
  attendedSessionIds: string[];
  assignmentUrl?: string;
  assessmentScore?: number;
  status: EnrollmentStatus;
  certificateDocId?: string;
  /** Trainer feedback fed into the startup progress profile (LMS-03). */
  feedback?: string;
  enrolledAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

// ============================================================================
// Phase 3 — core/consent (AIO-04, IDM-04 at contact level)
// ============================================================================

export type ConsentPurpose =
  | "outreach"
  | "data_sharing"
  // Phase 4 acknowledgements (ABS-09 / INV-07) — recorded before sensitive access.
  | "coi"
  | "confidentiality"
  | "investment_disclaimer"
  | "data_use";

/** The acknowledgement purposes a self-service role can record for themselves. */
export const ACKNOWLEDGEMENT_PURPOSES = ["coi", "confidentiality", "investment_disclaimer", "data_use"] as const;

/** Per-contact, per-purpose, revocable consent. id == `${contactId}_${purpose}`. */
export interface ConsentDoc {
  id: string;
  startupId: string;
  founderId: string;
  contactId: string;
  contactEmail?: string;
  purpose: ConsentPurpose;
  granted: boolean;
  source: string;
  grantedAt?: Timestamp;
  revokedAt?: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Phase 3 — features/crm (OPS-01, OPS-02, OPS-07)
// ============================================================================

/** How a startup runs a given operations area (OPS-07). */
export type OpsMode = "built_in" | "external" | "managed";

export const OPS_MODE_LABELS: Record<OpsMode, string> = {
  built_in: "Built-in tools",
  external: "External integration",
  managed: "Managed by a provider",
};

export type PipelineStage = "lead" | "qualified" | "proposal" | "won" | "lost";

export const PIPELINE_STAGES: PipelineStage[] = ["lead", "qualified", "proposal", "won", "lost"];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

export interface CrmContactDoc {
  id: string;
  startupId: string;
  founderId: string;
  name: string;
  email?: string;
  company?: string;
  /** Who contributed this contact/lead (OPS-02) — a sales mentor / staff / self. */
  contributedByUid?: string;
  contributedByName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CrmOpportunityDoc {
  id: string;
  startupId: string;
  founderId: string;
  contactId?: string;
  title: string;
  stage: PipelineStage;
  value: number;
  notes?: string;
  /** Set when moved to won/lost (conversion reporting). */
  closedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Per-startup CRM/finance operating modes (OPS-07). id == startupId. */
export interface OpsConfigDoc {
  id: string;
  startupId: string;
  founderId: string;
  crmMode: OpsMode;
  financeMode: OpsMode;
  /** Directory provider id when a mode is "managed". */
  crmProviderId?: string;
  financeProviderId?: string;
  updatedAt: Timestamp;
}

// ============================================================================
// Phase 3 — features/accounting (OPS-03)
// ============================================================================

export type FinanceEntryKind = "invoice" | "expense";

export interface FinanceEntryDoc {
  id: string;
  startupId: string;
  founderId: string;
  kind: FinanceEntryKind;
  description: string;
  amount: number;
  /** invoices: paid?; expenses: unused. */
  paid?: boolean;
  occurredAt: Timestamp;
  createdAt: Timestamp;
}

// ============================================================================
// Phase 3 — features/opsRollup (OPS-06)
// ============================================================================

/** Non-sensitive per-startup rollup (id == startupId). Staff read THIS, never
 *  raw CRM/finance rows. Each feature upserts its own fields on write. */
export interface OpsSummaryDoc {
  id: string;
  startupId: string;
  founderId: string;
  startupName: string;
  pipelineValue: number;
  openOpportunities: number;
  wonOpportunities: number;
  wonValue: number;
  invoicedTotal: number;
  expenseTotal: number;
  cashPosition: number;
  /** Outreach outcomes rolled up for the management dashboard (AIO-05). */
  outreachSent?: number;
  outreachResponses?: number;
  outreachConversions?: number;
  outreachSalesValue?: number;
  /** Adoption impact rolled up for the management dashboard (ABS-08). */
  adoptionMentorHours?: number;
  adoptionSalesLeads?: number;
  adoptionFundsCommittedLakh?: number;
  adoptionIntroductions?: number;
  updatedAt: Timestamp;
}

// ============================================================================
// Phase 3 — features/ipSupport (IP-01, IP-02) — companion to a core/tickets ticket
// ============================================================================

export type IpCaseType = "patent" | "trademark" | "design" | "copyright" | "confidentiality";

export const IP_CASE_TYPE_LABELS: Record<IpCaseType, string> = {
  patent: "Patent",
  trademark: "Trademark / brand",
  design: "Design registration",
  copyright: "Copyright",
  confidentiality: "Confidentiality / NDA",
};

/** IP-only metadata. id == the ticketId of the core/tickets ticket driving the case workflow. */
export interface IpCaseDoc {
  id: string;
  ticketId: string;
  startupId: string;
  founderId: string;
  ipType: IpCaseType;
  /** Lightweight fee/credit ledger for the case. */
  feeCredits: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Phase 3 — core/documents NDA extension (IP-04)
// ============================================================================

export type NdaStatus = "pending" | "signed" | "granted";

export interface NdaTemplateOption {
  key: string;
  label: string;
}

export const NDA_TEMPLATES: NdaTemplateOption[] = [
  { key: "mutual", label: "Mutual NDA" },
  { key: "one_way", label: "One-way NDA (recipient)" },
  { key: "advisor", label: "Advisor / mentor NDA" },
];

/**
 * Links a signer to the document their signed NDA unlocks. Separate from the
 * documents `visibleTo` restriction (IP-05): on grant, the signer's uid is
 * added to the target document's visibleTo.
 */
export interface NdaAgreementDoc {
  id: string;
  startupId: string;
  founderId: string;
  templateKey: string;
  signerUid: string;
  signerName: string;
  /** The document this NDA gates access to. */
  unlocksDocId: string;
  status: NdaStatus;
  /** The recorded signed copy in the vault. */
  signedDocId?: string;
  createdBy: string;
  createdAt: Timestamp;
  signedAt?: Timestamp;
  grantedAt?: Timestamp;
}

// ============================================================================
// Phase 3 — features/outreach (AIO-01, AIO-02, AIO-04, AIO-05)
// ============================================================================

export type OutreachChannel = "email" | "whatsapp" | "linkedin" | "call_script" | "landing" | "follow_up";

export const OUTREACH_CHANNEL_LABELS: Record<OutreachChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn message",
  call_script: "Call script",
  landing: "Landing page copy",
  follow_up: "Follow-up sequence",
};

/** Draft → approved → sent. Nothing sends without an explicit founder approval (AIO-04). */
export type CampaignStatus = "draft" | "approved" | "sent";

export interface CampaignOutcome {
  sent: number;
  responses: number;
  meetings: number;
  conversions: number;
  salesValue: number;
  updatedAt: Timestamp;
}

export interface CampaignDoc {
  id: string;
  startupId: string;
  founderId: string;
  name: string;
  channel: OutreachChannel;
  brief: { segment: string; valueProp: string; goal: string; tone?: string; language?: string };
  contactIds: string[];
  /** AI-generated body, pending human approval. */
  draft?: string;
  draftModel?: string;
  /** Recipients the server confirmed as consent-cleared on the last generation. */
  includedContactIds?: string[];
  excludedContactIds?: string[];
  status: CampaignStatus;
  approvedBy?: string;
  approvedAt?: Timestamp;
  outcome?: CampaignOutcome;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Phase 4 — features/investors (INV-01) + features/investorProfiles (INV-02)
// ============================================================================

export type InvestorEngagement = "active" | "paused";

/** An angel investor's own profile. id == uid. Admin verifies the person (identityStatus). */
export interface InvestorProfileDoc {
  id: string;
  uid: string;
  name: string;
  sectors: string[];
  ticketMinLakh: number;
  ticketMaxLakh: number;
  geographies: string[];
  stagePreferences: string[];
  portfolio: string;
  languages: string[];
  engagement: InvestorEngagement;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type InvestorProfileStatus = "draft" | "in_review" | "published";

/** A founder's investor-facing profile (INV-02). id == startupId. Staff review before publish. */
export interface StartupInvestorProfileDoc {
  id: string;
  startupId: string;
  founderId: string;
  startupName: string;
  pitch: string;
  traction: string;
  team: string;
  financialSummary: string;
  fundingAskLakh: number;
  useOfFunds: string;
  documentIds: string[];
  status: InvestorProfileStatus;
  reviewedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Phase 4 — features/dataRooms (INV-04)
// ============================================================================

export type DataRoomRequestStatus = "requested" | "approved" | "denied";

export interface DataRoomRequestDoc {
  id: string;
  startupId: string;
  founderId: string;
  startupName: string;
  investorUid: string;
  investorName: string;
  message: string;
  status: DataRoomRequestStatus;
  decidedBy?: string;
  createdAt: Timestamp;
  decidedAt?: Timestamp;
}

export type DataRoomAccessAction = "granted" | "viewed";

/** Append-only access log (INV-04). */
export interface DataRoomAccessLogDoc {
  id: string;
  startupId: string;
  founderId: string;
  investorUid: string;
  action: DataRoomAccessAction;
  docId?: string;
  at: Timestamp;
  by: string;
}

// ============================================================================
// Phase 4 — features/pitchEvents (INV-05) + features/dealPipeline (INV-06)
// ============================================================================

export type PitchEventStatus = "draft" | "open" | "closed";

/**
 * Pitch/investor event. Per-slot scheduling would reuse core/meetings, but that
 * primitive's `kind` set (mentor/fablab) doesn't include a pitch kind — adding
 * one is a core change deferred out of this phase. Events here cover invites,
 * shortlist, and feedback; feedback lives in a subcollection.
 */
export interface PitchEventDoc {
  id: string;
  title: string;
  description: string;
  at: Timestamp;
  status: PitchEventStatus;
  investorUids: string[];
  shortlistStartupIds: string[];
  /** Denormalized founder uids of shortlisted startups — for rule read-gating. */
  shortlistFounderIds: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** pitchEvents/{id}/feedback/{investorUid} — one per investor, keyed by uid. */
export interface PitchFeedbackDoc {
  investorUid: string;
  investorName: string;
  startupId: string;
  note: string;
  at: Timestamp;
}

/**
 * Deal pipeline (INV-06). INV-07: discovery-only — NO financial transaction is
 * recorded. `commitment`/`closed` are informational status labels with an audit
 * entry, never a settlement.
 */
export type DealStage = "interest" | "diligence" | "term" | "commitment" | "closed" | "dropped";

export const DEAL_STAGES: DealStage[] = ["interest", "diligence", "term", "commitment", "closed", "dropped"];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  interest: "Expression of interest",
  diligence: "Diligence",
  term: "Term discussion",
  commitment: "Commitment (label only)",
  closed: "Closed (label only)",
  dropped: "Dropped",
};

export interface DealEntryDoc {
  id: string;
  startupId: string;
  startupName: string;
  founderId: string;
  investorUid: string;
  investorName: string;
  stage: DealStage;
  notes: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Phase 4 — features/adoption + adoptionWorkspace (ABS-01..09)
// ============================================================================

export type AdoptionMode =
  | "mentor"
  | "technical_advisor"
  | "market_access"
  | "sales_champion"
  | "investor"
  | "board_advisory"
  | "diaspora_ambassador"
  | "pooled_support";

export const ADOPTION_MODE_LABELS: Record<AdoptionMode, string> = {
  mentor: "Mentor",
  technical_advisor: "Technical advisor",
  market_access: "Market access partner",
  sales_champion: "Sales champion",
  investor: "Investor",
  board_advisory: "Board / advisory member",
  diaspora_ambassador: "Diaspora ambassador",
  pooled_support: "Pooled support circle",
};

/** Probasi Bangali adopter profile (ABS-01). id == uid; admin verifies identity. */
export interface AdopterProfileDoc {
  id: string;
  uid: string;
  name: string;
  location: string;
  sectorExpertise: string[];
  languages: string[];
  availability: string;
  contributionModes: AdoptionMode[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AdoptionRequestStatus = "requested" | "accepted" | "declined" | "negotiating";

export interface AdoptionRequestDoc {
  id: string;
  startupId: string;
  founderId: string;
  startupName: string;
  adopterUid: string;
  adopterName: string;
  modes: AdoptionMode[];
  message: string;
  status: AdoptionRequestStatus;
  createdAt: Timestamp;
  decidedAt?: Timestamp;
}

export interface AdoptionImpact {
  mentorHours: number;
  salesLeads: number;
  meetings: number;
  fundsCommittedLakh: number;
  introductions: number;
  docsReviewed: number;
}

/** Adoption workspace (ABS-05). id == `${startupId}_${adopterUid}` — deterministic
 *  so rules (e.g. adopter CRM-lead contribution, ABS-06) can check membership. */
export interface AdoptionWorkspaceDoc {
  id: string;
  startupId: string;
  founderId: string;
  startupName: string;
  adopterUid: string;
  adopterName: string;
  modes: AdoptionMode[];
  goals: string;
  commitments: string;
  impact: AdoptionImpact;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// Hardening — duplicate identity detection & merge (IDM-02 / NFR-09)
// ============================================================================

export type DuplicateSubject = "person" | "organisation";
export type DuplicateStatus = "open" | "dismissed" | "merged";

/** An admin review-queue entry: two records suspected to be the same identity. */
export interface DuplicateCandidateDoc {
  id: string;
  subject: DuplicateSubject;
  recordType: "users" | "startups";
  recordIdA: string;
  recordIdB: string;
  labelA: string;
  labelB: string;
  matchReason: string;
  matchedOn: string[];
  status: DuplicateStatus;
  detectedBy: string;
  reviewedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
