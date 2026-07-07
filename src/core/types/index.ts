import type { Timestamp } from "firebase/firestore";

/**
 * Single source of truth for data shapes across every feature.
 * Extend additively — never rewrite a field's meaning once shipped.
 */

export type Role = "admin" | "cohort_manager" | "evaluator" | "founder";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface UserDoc {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  approvalStatus: ApprovalStatus;
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
  | "graduation.decide";

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
  | "graduation";

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

/** Shared ticket primitive (Section 4.1) — used by services (ECO-02) and helpdesk (SUP-01). */
export type TicketKind = "service" | "helpdesk";
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
