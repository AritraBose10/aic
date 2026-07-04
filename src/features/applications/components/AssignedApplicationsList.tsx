"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useAssignedApplications } from "@/features/applications/hooks/useAssignedApplications";
import { useMyScore } from "@/features/applications/hooks/useMyScore";
import type { ApplicationDoc } from "@/core/types";

function AssignedApplicationRow({
  application,
  evaluatorUid,
}: {
  application: ApplicationDoc;
  evaluatorUid: string;
}) {
  const { score } = useMyScore(application.id, evaluatorUid);

  return (
    <Link href={`/evaluate/${application.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-base">{application.startupName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {application.cohortName} · {application.sector}
            </p>
          </div>
          <Badge
            variant="secondary"
            className={score ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}
          >
            {score
              ? score.conflictOfInterest
                ? "Conflict declared"
                : "Scored"
              : "Awaiting your review"}
          </Badge>
        </CardHeader>
      </Card>
    </Link>
  );
}

export function AssignedApplicationsList() {
  const { userDoc } = useAuth();
  const { applications, loading } = useAssignedApplications(userDoc?.uid);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading assigned applications...</div>;
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <ClipboardList className="size-8" />
          <p className="text-sm">No applications assigned to you yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((application) => (
        <AssignedApplicationRow
          key={application.id}
          application={application}
          evaluatorUid={userDoc!.uid}
        />
      ))}
    </div>
  );
}
