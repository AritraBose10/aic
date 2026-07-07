"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, FileStack, Lock, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCohortApplications } from "@/features/applications/hooks/useCohortApplications";
import { useApplicationScores } from "@/features/applications/hooks/useApplicationScores";
import { EvaluatorAssignmentPanel } from "@/features/applications/components/EvaluatorAssignmentPanel";
import { FounderVerificationControl } from "@/features/startups/components/FounderVerificationControl";
import {
  recordCommitteeDecision,
  reopenCommitteeDecision,
  setApplicationEligibility,
} from "@/features/applications/lib/applicationActions";
import type { ApplicationDoc, ApplicationStatus } from "@/core/types";

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

function ApplicationReviewCard({ application }: { application: ApplicationDoc }) {
  const { userDoc } = useAuth();
  const { scores } = useApplicationScores(application.id);
  // Committee notes are write-only from here — they live in a staff-only
  // subcollection, not on the founder-readable application doc.
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const scored = scores.filter((s) => !s.conflictOfInterest);
  const average = scored.length
    ? (scored.reduce((sum, s) => sum + s.score, 0) / scored.length).toFixed(1)
    : null;
  const locked = Boolean(application.committeeDecision?.locked);

  async function handleDecision(decision: "selected" | "rejected" | "waitlisted") {
    if (!userDoc) return;
    setBusy(true);
    try {
      await recordCommitteeDecision(application.id, decision, notes);
      toast.success(`Application ${decision}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record decision");
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    if (!userDoc) return;
    setBusy(true);
    try {
      await reopenCommitteeDecision(application.id);
      toast.success("Decision reopened");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reopen decision");
    } finally {
      setBusy(false);
    }
  }

  async function handleEligibility(value: string | null) {
    if (!userDoc) return;
    const isEligible = value === "eligible" ? true : value === "ineligible" ? false : null;
    try {
      await setApplicationEligibility(application.id, { uid: userDoc.uid, role: userDoc.role }, isEligible);
    } catch {
      toast.error("Could not update eligibility");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{application.startupName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {application.sector} · {application.district} · {application.stage}
          </p>
        </div>
        <Badge variant="secondary" className={STATUS_STYLE[application.status]}>
          {STATUS_LABEL[application.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm whitespace-pre-wrap">{application.pitchSummary}</p>
        {application.documentUrls[0] && (
          <a
            href={application.documentUrls[0]}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm text-primary hover:underline"
          >
            View pitch deck
          </a>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <EvaluatorAssignmentPanel application={application} />
          <Select
            value={application.isEligible === true ? "eligible" : application.isEligible === false ? "ineligible" : "unset"}
            onValueChange={handleEligibility}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Eligibility unset</SelectItem>
              <SelectItem value="eligible">Eligible</SelectItem>
              <SelectItem value="ineligible">Not eligible</SelectItem>
            </SelectContent>
          </Select>
          {average && (
            <span className="text-sm text-muted-foreground">Avg score: {average}/10</span>
          )}
        </div>

        {scores.length > 0 && (
          <div className="space-y-2 rounded-md border border-border p-3">
            {scores.map((s) => (
              <div key={s.evaluatorId} className="flex items-start justify-between text-sm">
                <div>
                  {s.conflictOfInterest ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <AlertTriangle className="size-3.5" /> Conflict declared
                    </span>
                  ) : (
                    <>
                      <span className="font-medium">{s.score}/10</span>
                      {s.comments && <p className="mt-0.5 text-muted-foreground">{s.comments}</p>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {application.status === "selected" && (
          <div className="flex items-center justify-between rounded-md border border-border bg-accent/40 p-3">
            <span className="text-sm text-muted-foreground">Onboarding</span>
            <FounderVerificationControl startupId={application.startupId} />
          </div>
        )}

        {locked ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
            <span className="flex items-center gap-1.5 text-sm">
              <Lock className="size-3.5" />
              Decision locked: {application.committeeDecision?.decision}
            </span>
            {userDoc?.role === "admin" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={handleReopen}>
                <RotateCcw className="size-4" />
                Reopen
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              placeholder="Committee notes (optional)"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="success" disabled={busy} onClick={() => handleDecision("selected")}>
                <Check className="size-4" />
                Select
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => handleDecision("waitlisted")}>
                Waitlist
              </Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleDecision("rejected")}>
                <X className="size-4" />
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CommitteeReviewView({ cohortId }: { cohortId: string }) {
  const { applications, loading } = useCohortApplications(cohortId);
  const reviewable = applications.filter((a) => a.status !== "draft");

  if (loading) return <div className="text-sm text-muted-foreground">Loading applications...</div>;

  if (reviewable.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <FileStack className="size-8" />
          <p className="text-sm">No submitted applications for this cohort yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviewable.map((application) => (
        <ApplicationReviewCard key={application.id} application={application} />
      ))}
    </div>
  );
}
