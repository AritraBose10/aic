"use client";

import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { CohortsManagerView } from "@/features/cohorts/components/CohortsManagerView";
import { CohortBrowseList } from "@/features/cohorts/components/CohortBrowseList";

function CohortsContent() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;

  if (userDoc.role === "admin" || userDoc.role === "cohort_manager") {
    return <CohortsManagerView />;
  }
  if (userDoc.role === "founder") {
    return <CohortBrowseList />;
  }
  return (
    <p className="text-sm text-muted-foreground">
      There are no cohort actions for your role yet.
    </p>
  );
}

export default function CohortsPage() {
  return (
    <ProtectedRoute>
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <CohortsContent />
      </div>
    </ProtectedRoute>
  );
}
