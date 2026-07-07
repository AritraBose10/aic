"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Award, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useAllStartups } from "@/features/dashboard/hooks/usePortfolio";
import { useGraduation } from "@/features/graduation/hooks/useGraduation";
import { saveScorecard, decideGraduation } from "@/features/graduation/lib/graduationActions";
import { DEFAULT_GRADUATION_CRITERIA, type GraduationCriterion, type StartupDoc } from "@/core/types";

function Scorecard({ startup }: { startup: StartupDoc }) {
  const { userDoc } = useAuth();
  const { graduation } = useGraduation(startup.id);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<GraduationCriterion[]>(
    DEFAULT_GRADUATION_CRITERIA.map((c) => ({ ...c, met: false })),
  );
  const [busy, setBusy] = useState(false);

  // Hydrate from the saved scorecard once it loads (adjust-during-render guard).
  if (graduation && graduation.id !== loadedId) {
    setLoadedId(graduation.id);
    if (graduation.criteria?.length) setCriteria(graduation.criteria);
  }

  const met = criteria.filter((c) => c.met).length;
  const score = Math.round((met / criteria.length) * 100);
  const startupCtx = {
    id: startup.id,
    name: startup.name,
    cohortId: startup.incubation?.cohortId ?? "",
    founderId: startup.founderId,
  };

  async function save() {
    if (!userDoc) return;
    setBusy(true);
    try {
      await saveScorecard({ uid: userDoc.uid, role: userDoc.role }, startupCtx, criteria);
      toast.success("Scorecard saved");
    } catch {
      toast.error("Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "graduated" | "not_ready") {
    if (!userDoc) return;
    setBusy(true);
    try {
      await saveScorecard({ uid: userDoc.uid, role: userDoc.role }, startupCtx, criteria);
      await decideGraduation({ uid: userDoc.uid, role: userDoc.role }, startupCtx, decision);
      toast.success(decision === "graduated" ? "Graduated — certificate + report issued" : "Marked not ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record decision");
    } finally {
      setBusy(false);
    }
  }

  if (startup.alumni) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-success">
        <Award className="size-4" /> Graduated to alumni on{" "}
        {startup.alumni.graduatedAt?.toDate?.().toLocaleDateString() ?? "—"}.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {criteria.map((c, i) => (
          <div key={c.key} className="flex items-center gap-2">
            <Checkbox
              id={`${startup.id}-${c.key}`}
              checked={c.met}
              onCheckedChange={() =>
                setCriteria((prev) => prev.map((x, j) => (j === i ? { ...x, met: !x.met } : x)))
              }
            />
            <Label htmlFor={`${startup.id}-${c.key}`} className="font-normal">
              {c.label}
            </Label>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Readiness score: <span className="font-medium text-foreground">{score}%</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={save}>
          Save scorecard
        </Button>
        <Button size="sm" variant="success" disabled={busy} onClick={() => decide("graduated")}>
          <GraduationCap className="size-4" /> Graduate
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => decide("not_ready")}>
          Not ready
        </Button>
      </div>
    </div>
  );
}

export function GraduationManager() {
  const { startups, loading } = useAllStartups();
  const [expanded, setExpanded] = useState<string | null>(null);
  const incubatees = startups.filter((s) => s.incubation);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Graduation</CardTitle>
        <CardDescription>
          Apply the readiness scorecard and transition startups to alumni. History (KPIs,
          documents) is preserved on graduation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : incubatees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No incubatees yet.</p>
        ) : (
          incubatees.map((s) => (
            <div key={s.id} className="rounded-md border border-border">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.incubation?.cohortName}</p>
                </div>
                {s.alumni ? (
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    Alumni
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    {expanded === s.id ? "Hide" : "Scorecard"}
                  </Button>
                )}
              </div>
              {expanded === s.id && !s.alumni && (
                <div className="border-t border-border p-3">
                  <Scorecard startup={s} />
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
