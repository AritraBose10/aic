"use client";

import Link from "next/link";
import { FileStack } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyApplications } from "@/features/applications/hooks/useMyApplications";
import type { ApplicationStatus } from "@/core/types";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  interviewed: "Interviewed",
  selected: "Selected",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
};

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-accent text-accent-foreground",
  under_review: "bg-accent text-accent-foreground",
  interviewed: "bg-accent text-accent-foreground",
  selected: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  waitlisted: "bg-secondary text-secondary-foreground",
};

export function MyApplicationsList() {
  const { userDoc } = useAuth();
  const { applications, loading } = useMyApplications(userDoc?.uid);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading your applications...</div>;
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <FileStack className="size-8" />
          <p className="text-sm">
            No applications yet. Browse open cohorts on the{" "}
            <Link href="/cohorts" className="text-foreground hover:underline">
              Cohorts
            </Link>{" "}
            page to apply.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((application) => (
        <Link key={application.id} href={`/applications/${application.id}`}>
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-base">{application.cohortName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {application.startupName} · {application.sector}
                </p>
              </div>
              <Badge variant="secondary" className={STATUS_STYLE[application.status]}>
                {STATUS_LABEL[application.status]}
              </Badge>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
