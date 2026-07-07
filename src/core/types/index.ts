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
  | "startup.kpi.snapshot";

export interface AuditEventDoc {
  id: string;
  actorId: string;
  actorRole: Role;
  action: AuditAction;
  entityType: "user" | "cohort" | "application" | "startup";
  entityId: string;
  details?: Record<string, unknown>;
  timestamp: Timestamp;
}
