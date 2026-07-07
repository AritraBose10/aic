"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useApplication } from "@/features/applications/hooks/useApplication";
import { useMyScore } from "@/features/applications/hooks/useMyScore";
import { submitScore } from "@/features/applications/lib/applicationActions";

export function ScorecardForm({ applicationId }: { applicationId: string }) {
  const { userDoc } = useAuth();
  const { application, loading } = useApplication(applicationId);
  const { score: existingScore, loading: scoreLoading } = useMyScore(applicationId, userDoc?.uid);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [score, setScore] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Prefill once, after the existing score has loaded, without clobbering edits.
  if (!scoreLoading && prefilledFor !== applicationId) {
    setPrefilledFor(applicationId);
    setHasConflict(existingScore?.conflictOfInterest ?? false);
    setScore(existingScore && !existingScore.conflictOfInterest ? String(existingScore.score) : "");
    setComments(existingScore?.comments ?? "");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader size="sm" />
        Loading…
      </div>
    );
  }
  if (!application) return <div className="text-sm text-muted-foreground">Application not found.</div>;

  const locked = Boolean(application.committeeDecision?.locked);
  const scoreValid = hasConflict || (score.trim() !== "" && Number(score) >= 1 && Number(score) <= 10);

  async function handleSubmit() {
    if (!userDoc) return;
    setSubmitting(true);
    try {
      await submitScore(
        applicationId,
        { uid: userDoc.uid, role: userDoc.role },
        { conflictOfInterest: hasConflict, score: hasConflict ? null : Number(score), comments },
      );
      toast.success("Scorecard saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save scorecard");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{application.startupName}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {application.cohortName} · {application.sector} · {application.district}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Pitch summary</p>
          <p className="mt-1 text-sm whitespace-pre-wrap">{application.pitchSummary}</p>
        </div>
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

        {locked ? (
          <p className="text-sm text-muted-foreground">
            The committee decision for this application is locked — scores can no longer be
            changed.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Conflict of interest</Label>
              <RadioGroup
                value={hasConflict ? "yes" : "no"}
                onValueChange={(v) => setHasConflict(v === "yes")}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="coi-no" />
                  <Label htmlFor="coi-no" className="font-normal">
                    No conflict — I can review this application
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="coi-yes" />
                  <Label htmlFor="coi-yes" className="font-normal">
                    I have a conflict of interest with this applicant
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {!hasConflict && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="score">Score (1–10)</Label>
                  <Input
                    id="score"
                    type="number"
                    min={1}
                    max={10}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="w-24"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comments">Comments</Label>
                  <Textarea
                    id="comments"
                    rows={4}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting || !scoreValid}>
                <Send className="size-4" />
                {submitting ? "Saving..." : "Save scorecard"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
