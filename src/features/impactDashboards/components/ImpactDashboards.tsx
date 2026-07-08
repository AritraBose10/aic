"use client";

import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useAllOpsSummaries } from "@/features/dashboard/hooks/usePortfolio";
import { useAdoptionWorkspaces } from "@/features/adoptionWorkspace/hooks/useWorkspaces";

/** Management-facing adoption impact (ABS-08) — reads the opsSummary rollup, never raw workspaces. */
function ManagementImpact() {
  const { summaries, loading } = useAllOpsSummaries();
  const rows = summaries.filter((s) => (s.adoptionMentorHours ?? 0) + (s.adoptionSalesLeads ?? 0) + (s.adoptionIntroductions ?? 0) > 0);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4" /> Adoption impact (portfolio)</CardTitle>
        <CardDescription>Aggregated from the ops rollup — no raw workspace data.</CardDescription></CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : rows.length === 0 ? <p className="text-sm text-muted-foreground">No adoption impact recorded yet.</p>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Startup</TableHead><TableHead>Mentor hrs</TableHead><TableHead>Leads</TableHead>
                <TableHead>Intros</TableHead><TableHead>Funds (₹L)</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.startupName}</TableCell>
                    <TableCell className="tabular-nums">{r.adoptionMentorHours ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{r.adoptionSalesLeads ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{r.adoptionIntroductions ?? 0}</TableCell>
                    <TableCell className="tabular-nums">{r.adoptionFundsCommittedLakh ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </CardContent>
    </Card>
  );
}

/** Adopter-facing view of their OWN contribution across their workspaces. */
function AdopterImpact({ uid }: { uid: string }) {
  const workspaces = useAdoptionWorkspaces({ adopterUid: uid });
  const total = workspaces.reduce((acc, w) => ({
    mentorHours: acc.mentorHours + (w.impact?.mentorHours ?? 0),
    salesLeads: acc.salesLeads + (w.impact?.salesLeads ?? 0),
    introductions: acc.introductions + (w.impact?.introductions ?? 0),
    fundsCommittedLakh: acc.fundsCommittedLakh + (w.impact?.fundsCommittedLakh ?? 0),
  }), { mentorHours: 0, salesLeads: 0, introductions: 0, fundsCommittedLakh: 0 });
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4" /> Your contribution</CardTitle>
        <CardDescription>Across {workspaces.length} adoption workspace(s).</CardDescription></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Mentor hours" value={total.mentorHours} />
        <Tile label="Sales leads" value={total.salesLeads} />
        <Tile label="Introductions" value={total.introductions} />
        <Tile label="Funds (₹ lakh)" value={total.fundsCommittedLakh} />
      </CardContent>
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function ImpactDashboards() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;
  const isStaff = userDoc.role === "admin" || userDoc.role === "cohort_manager";
  const isAdopter = userDoc.role === "probasi_adopter";
  return (
    <div className="space-y-6">
      {isStaff && <ManagementImpact />}
      {isAdopter && <AdopterImpact uid={userDoc.uid} />}
    </div>
  );
}
