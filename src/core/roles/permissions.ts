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
  | "dashboard:view_portfolio";

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
  ],
  cohort_manager: [
    "cohort:create",
    "cohort:edit",
    "cohort:view_all",
    "application:view_all",
    "application:decide",
    "startup:view_all",
    "dashboard:view_portfolio",
  ],
  evaluator: ["application:view_assigned", "application:score"],
  founder: [
    "application:create",
    "application:view_own",
    "startup:create",
    "startup:view_own",
    "startup:edit_own",
  ],
};

export function can(role: Role, action: Action): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

export function permissionsFor(role: Role): Action[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
