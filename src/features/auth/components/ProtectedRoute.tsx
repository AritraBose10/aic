"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/PageLoader";
import { SessionGuard } from "@/features/auth/components/SessionGuard";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Role } from "@/core/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

/**
 * Gates a route on: signed in -> approved -> (optional) role membership.
 * Redirects rather than rendering nothing indefinitely, so a stuck user
 * always lands somewhere actionable.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { firebaseUser, userDoc, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser || !userDoc) {
      router.replace("/login");
      return;
    }
    if (userDoc.approvalStatus !== "approved") {
      router.replace("/pending-approval");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(userDoc.role)) {
      router.replace("/dashboard");
    }
  }, [loading, firebaseUser, userDoc, allowedRoles, router]);

  if (loading || !firebaseUser || !userDoc || userDoc.approvalStatus !== "approved") {
    return <PageLoader />;
  }

  if (allowedRoles && !allowedRoles.includes(userDoc.role)) {
    return null;
  }

  return (
    <>
      <SessionGuard />
      {children}
    </>
  );
}
