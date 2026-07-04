"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarRange, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useOpenCohorts } from "@/features/cohorts/hooks/useCohorts";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { useMyApplications } from "@/features/applications/hooks/useMyApplications";
import { getOrCreateDraftApplication } from "@/features/applications/lib/applicationActions";

export function CohortBrowseList() {
  const { userDoc } = useAuth();
  const router = useRouter();
  const { cohorts, loading } = useOpenCohorts();
  const { startup, loading: startupLoading } = useMyStartup(userDoc?.uid);
  const { applications } = useMyApplications(userDoc?.uid);
  const [applyingTo, setApplyingTo] = useState<string | null>(null);

  const applicationByCohort = new Map(applications.map((a) => [a.cohortId, a]));

  async function handleApply(cohortId: string) {
    if (!userDoc || !startup) return;
    const cohort = cohorts.find((c) => c.id === cohortId);
    if (!cohort) return;
    setApplyingTo(cohortId);
    try {
      const id = await getOrCreateDraftApplication({ uid: userDoc.uid, role: userDoc.role }, startup, cohort);
      router.push(`/applications/${id}`);
    } catch {
      toast.error("Could not start application");
    } finally {
      setApplyingTo(null);
    }
  }

  if (loading || startupLoading) {
    return <div className="text-sm text-muted-foreground">Loading cohorts...</div>;
  }

  if (!startup) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Create your startup profile before applying to a cohort.
          </p>
          <Link href="/startup" className={buttonVariants({ size: "sm" })}>
            Create startup profile
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (cohorts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Layers className="size-8" />
          <p className="text-sm">No cohorts are open for applications right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cohorts.map((cohort) => {
        const existing = applicationByCohort.get(cohort.id);
        return (
          <Card key={cohort.id}>
            <CardHeader>
              <CardTitle className="text-base">{cohort.name}</CardTitle>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {cohort.sectorFocus.map((sector) => (
                  <Badge key={sector} variant="secondary">
                    {sector}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarRange className="size-3.5" />
                Closes {cohort.applicationCloseAt.toDate().toLocaleDateString()}
              </p>
              {existing ? (
                <Link href={`/applications/${existing.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                  {existing.status === "draft" ? "Continue draft" : "View application"}
                </Link>
              ) : (
                <Button size="sm" disabled={applyingTo === cohort.id} onClick={() => handleApply(cohort.id)}>
                  {applyingTo === cohort.id ? "Starting..." : "Apply"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
