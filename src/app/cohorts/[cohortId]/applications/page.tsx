"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { useCohort } from "@/features/cohorts/hooks/useCohort";
import { CommitteeReviewView } from "@/features/applications/components/CommitteeReviewView";

export default function CohortApplicationsPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = use(params);
  const { cohort } = useCohort(cohortId);

  return (
    <ProtectedRoute allowedRoles={["admin", "cohort_manager"]}>
      <AppHeader />
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link href="/cohorts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to cohorts
        </Link>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          {cohort ? `${cohort.name} — applications` : "Applications"}
        </h1>
        <CommitteeReviewView cohortId={cohortId} />
      </div>
    </ProtectedRoute>
  );
}
