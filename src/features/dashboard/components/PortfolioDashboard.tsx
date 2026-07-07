"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Filter, Layers, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCohorts } from "@/features/cohorts/hooks/useCohorts";
import { useAllApplications, useAllStartups } from "@/features/dashboard/hooks/usePortfolio";
import type { ApplicationStatus } from "@/core/types";

const ALL = "all";

// Pipeline stages shown as a distribution (an application is in exactly one).
const PIPELINE: { status: ApplicationStatus; label: string; className: string }[] = [
  { status: "submitted", label: "Submitted", className: "bg-sky-500" },
  { status: "under_review", label: "Under review", className: "bg-sky-600" },
  { status: "interviewed", label: "Interviewed", className: "bg-sky-700" },
  { status: "selected", label: "Selected", className: "bg-emerald-600" },
  { status: "waitlisted", label: "Waitlisted", className: "bg-slate-400" },
  { status: "rejected", label: "Rejected", className: "bg-slate-300 dark:bg-slate-600" },
];

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function PortfolioDashboard() {
  const { cohorts } = useCohorts();
  const { applications, loading } = useAllApplications();
  const { startups } = useAllStartups();

  const [cohortId, setCohortId] = useState<string>(ALL);
  const [sector, setSector] = useState<string>(ALL);
  const [stage, setStage] = useState<string>(ALL);

  const sectors = useMemo(
    () => Array.from(new Set(applications.map((a) => a.sector).filter(Boolean))).sort(),
    [applications],
  );
  const stages = useMemo(
    () => Array.from(new Set(applications.map((a) => a.stage).filter(Boolean))).sort(),
    [applications],
  );

  const filtered = useMemo(
    () =>
      applications.filter(
        (a) =>
          (cohortId === ALL || a.cohortId === cohortId) &&
          (sector === ALL || a.sector === sector) &&
          (stage === ALL || a.stage === stage),
      ),
    [applications, cohortId, sector, stage],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of filtered) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [filtered]);

  const nonDraft = filtered.filter((a) => a.status !== "draft").length;
  const selected = counts["selected"] ?? 0;
  const conversion = nonDraft > 0 ? Math.round((selected / nonDraft) * 100) : 0;
  const pipelineMax = Math.max(1, ...PIPELINE.map((p) => counts[p.status] ?? 0));

  const incubatees = startups.filter((s) => s.incubation);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading portfolio…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Filter className="size-4" /> Filters
          </span>
          <Select value={cohortId} onValueChange={(v) => setCohortId(v ?? ALL)}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="Cohort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All cohorts</SelectItem>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sector} onValueChange={(v) => setSector(v ?? ALL)}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sectors</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stage} onValueChange={(v) => setStage(v ?? ALL)}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total applications" value={filtered.length} />
        <StatTile label="In pipeline" value={nonDraft} hint="submitted or beyond" />
        <StatTile label="Selected" value={selected} />
        <StatTile label="Conversion" value={`${conversion}%`} hint="selected / in pipeline" />
      </div>

      {/* Funnel distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application funnel</CardTitle>
          <CardDescription>Applications by current stage (matching the filters).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PIPELINE.map((p) => {
            const n = counts[p.status] ?? 0;
            return (
              <div key={p.status} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm text-muted-foreground">{p.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                  <div
                    className={`h-full ${p.className} transition-all`}
                    style={{ width: `${(n / pipelineMax) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">{n}</span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No applications match these filters.</p>
          )}
        </CardContent>
      </Card>

      {/* Cohort capacity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cohort progress</CardTitle>
          <CardDescription>Selected startups against each cohort&apos;s capacity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cohorts.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <Layers className="size-7" />
              <p className="text-sm">No cohorts yet.</p>
            </div>
          )}
          {cohorts.map((c) => {
            const pct = c.capacity > 0 ? Math.min(100, Math.round((c.selectedCount / c.capacity) * 100)) : 0;
            const full = c.selectedCount >= c.capacity;
            return (
              <div key={c.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <Link href={`/cohorts/${c.id}/applications`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <span className={full ? "text-destructive" : "text-muted-foreground"}>
                    {c.selectedCount}/{c.capacity} selected
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${full ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Incubatees */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" /> Incubatees
          </CardTitle>
          <CardDescription>
            Selected startups in onboarding. Open one for its KPI history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {incubatees.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <Building2 className="size-7" />
              <p className="text-sm">No startups have been selected yet.</p>
            </div>
          ) : (
            incubatees.map((s) => {
              const ob = s.incubation!.onboarding;
              const done = Object.values(ob).filter(Boolean).length;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.incubation!.cohortName} · {s.sector}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={done === 5 ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"}
                  >
                    Onboarding {done}/5
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
