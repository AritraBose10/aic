"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useApplication } from "@/features/applications/hooks/useApplication";
import { saveApplicationDraft, submitApplication } from "@/features/applications/lib/applicationActions";
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

export function ApplicationForm({ applicationId }: { applicationId: string }) {
  const { userDoc } = useAuth();
  const { application, loading } = useApplication(applicationId);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [pitchSummary, setPitchSummary] = useState("");
  const [pitchDeckUrl, setPitchDeckUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Adjust local draft state during render when a new application loads —
  // not in an effect, so a live Firestore update after submit doesn't clobber
  // in-progress typing (see https://react.dev/learn/you-might-not-need-an-effect).
  if (application && application.id !== loadedId) {
    setLoadedId(application.id);
    setPitchSummary(application.pitchSummary);
    setPitchDeckUrl(application.documentUrls[0] ?? "");
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading application...</div>;
  }
  if (!application) {
    return <div className="text-sm text-muted-foreground">Application not found.</div>;
  }

  const isDraft = application.status === "draft";
  const summaryDone = pitchSummary.trim().length > 0;
  const deckDone = pitchDeckUrl.trim().length > 0;

  async function handleSaveDraft() {
    setSaving(true);
    try {
      await saveApplicationDraft(applicationId, { pitchSummary, pitchDeckUrl });
      toast.success("Draft saved");
    } catch {
      toast.error("Could not save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!userDoc) return;
    setSubmitting(true);
    try {
      await saveApplicationDraft(applicationId, { pitchSummary, pitchDeckUrl });
      await submitApplication(applicationId);
      toast.success("Application submitted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>{application.cohortName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {application.startupName} · {application.sector}
          </p>
        </div>
        <Badge variant="secondary" className={STATUS_STYLE[application.status]}>
          {STATUS_LABEL[application.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {isDraft ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="pitchSummary">Pitch summary</Label>
              <Textarea
                id="pitchSummary"
                rows={5}
                value={pitchSummary}
                onChange={(e) => setPitchSummary(e.target.value)}
                placeholder="What are you building, for whom, and why now?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pitchDeckUrl">Pitch deck link</Label>
              <Input
                id="pitchDeckUrl"
                placeholder="https://drive.google.com/..."
                value={pitchDeckUrl}
                onChange={(e) => setPitchDeckUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="mb-1 font-medium text-muted-foreground">Before you submit</p>
              <div className="flex items-center gap-2">
                {summaryDone ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
                Pitch summary written
              </div>
              <div className="flex items-center gap-2">
                {deckDone ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
                Pitch deck link added
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
                {saving ? "Saving..." : "Save draft"}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !summaryDone || !deckDone}>
                <Send className="size-4" />
                {submitting ? "Submitting..." : "Submit application"}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pitch summary</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{application.pitchSummary}</p>
            </div>
            {application.documentUrls[0] && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pitch deck</p>
                <a
                  href={application.documentUrls[0]}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm text-primary hover:underline"
                >
                  {application.documentUrls[0]}
                </a>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              This application has been submitted and can no longer be edited.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
