import type { Role } from "@/core/types";

/**
 * A new role is a new entry here — never a new `if` scattered across features.
 */
export type Action =
  | "user:approve"
  | "user:view_all"
  | "cohort:create"
  | "cohort:edit"
  | "cohort:view_all"
  | "application:create"
  | "application:view_own"
  | "application:view_assigned"
  | "application:view_all"
  | "application:score"
  | "application:decide"
  | "startup:create"
  | "startup:view_own"
  | "startup:edit_own"
  | "startup:view_all"
  | "dashboard:view_portfolio"
  // --- Phase 3 (additive) ---
  | "crm:manage_own"
  | "finance:manage_own"
  | "outreach:manage_own"
  | "ops:view_summary"
  | "ip:request"
  | "ip:manage"
  // --- Phase 4 ---
  | "investor:manage_own_profile"
  | "investor:discover"
  | "investor:publish_profile"
  | "adopter:manage_own_profile"
  | "adopter:discover"
  | "search:query";

const ROLE_PERMISSIONS: Record<Role, Action[]> = {
  admin: [
    "user:approve",
    "user:view_all",
    "cohort:create",
    "cohort:edit",
    "cohort:view_all",
    "application:view_all",
    "application:decide",
    "startup:view_all",
    "dashboard:view_portfolio",
    "ops:view_summary",
    "ip:manage",
    "search:query",
  ],
  cohort_manager: [
    "cohort:create",
    "cohort:edit",
    "cohort:view_all",
    "application:view_all",
    "application:decide",
    "startup:view_all",
    "dashboard:view_portfolio",
    "ops:view_summary",
    "ip:manage",
    "search:query",
  ],
  evaluator: ["application:view_assigned", "application:score"],
  founder: [
    "application:create",
    "application:view_own",
    "startup:create",
    "startup:view_own",
    "startup:edit_own",
    "crm:manage_own",
    "finance:manage_own",
    "outreach:manage_own",
    "ip:request",
    // Founder publishes their own investor-facing profile (INV-02).
    "investor:publish_profile",
    "search:query",
  ],
  // --- Phase 4 (self-service, admin-identity-verified) ---
  // These actions are UI-level; the *rules* additionally require isVerified()
  // server-side, so an unverified investor/adopter is denied even if the client
  // is tricked into showing the action.
  investor: ["investor:manage_own_profile", "investor:discover", "search:query"],
  probasi_adopter: ["adopter:manage_own_profile", "adopter:discover", "search:query"],
};

export function can(role: Role, action: Action): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

export function permissionsFor(role: Role): Action[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
