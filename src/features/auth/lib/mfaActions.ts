import {
  multiFactor,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  TotpSecret,
  type MultiFactorResolver,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { Role } from "@/core/types";

/**
 * SEC-04 — MFA scaffolding (TOTP). Firebase MFA requires Google Cloud Identity
 * Platform to be enabled on the project (a billing gate SEPARATE from Blaze).
 * All of this is built but inert until that upgrade: the SDK calls throw
 * `auth/operation-not-allowed` (or similar) until Identity Platform is on. No
 * enforcement is applied now, so privileged users aren't locked out pre-upgrade
 * — we only prompt them to enrol.
 */

/** Roles required to use MFA once Identity Platform is enabled. */
export function mfaRequiredFor(role: Role): boolean {
  return role === "admin" || role === "cohort_manager";
}

export function isMfaEnrolled(user: User): boolean {
  return multiFactor(user).enrolledFactors.length > 0;
}

export interface TotpEnrollmentStart {
  secret: TotpSecret;
  qrCodeUrl: string;
  secretKey: string;
}

/** Step 1: generate a TOTP secret + QR for the authenticator app. */
export async function startTotpEnrollment(user: User): Promise<TotpEnrollmentStart> {
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const qrCodeUrl = secret.generateQrCodeUrl(user.email ?? user.uid, "Bengal Startup Ecosystem");
  return { secret, qrCodeUrl, secretKey: secret.secretKey };
}

/** Step 2: verify the 6-digit code and enrol the factor. */
export async function finishTotpEnrollment(user: User, secret: TotpSecret, code: string): Promise<void> {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
  await multiFactor(user).enroll(assertion, "Authenticator app");
}

/**
 * Login-time challenge. Call from the sign-in catch block when the error code is
 * `auth/multi-factor-auth-required`; returns the resolver so the UI can prompt
 * for a code, then completes sign-in with `resolveTotpChallenge`.
 */
export function getResolver(error: unknown): MultiFactorResolver | null {
  const e = error as { code?: string };
  if (e?.code !== "auth/multi-factor-auth-required") return null;
  return getMultiFactorResolver(auth, error as Parameters<typeof getMultiFactorResolver>[1]);
}

export async function resolveTotpChallenge(resolver: MultiFactorResolver, code: string): Promise<void> {
  const totpHint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) ?? resolver.hints[0];
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code.trim());
  await resolver.resolveSignIn(assertion);
}
