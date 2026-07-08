"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ScanSearch, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useDuplicateCandidates } from "@/features/duplicates/hooks/useDuplicateCandidates";
import { runDuplicateScan, dismissCandidate, mergeIdentities } from "@/features/duplicates/lib/duplicateActions";
import type { DuplicateCandidateDoc } from "@/core/types";

function CandidateCard({ c, actor }: { c: DuplicateCandidateDoc; actor: { uid: string; role: import("@/core/types").Role } }) {
  const [busy, setBusy] = useState(false);
  async function merge(survivorId: string, loserId: string) {
    setBusy(true);
    try {
      const res = await mergeIdentities({ recordType: c.recordType, survivorId, loserId });
      toast.success(`Merged — ${res.reassigned} reference(s) reassigned`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed (needs Blaze deploy)");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{c.subject === "person" ? "Person" : "Organisation"} duplicate</CardTitle>
          <CardDescription>{c.matchReason}</CardDescription>
        </div>
        <Badge variant="secondary">{c.matchedOn.join(" + ")}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border p-2"><p className="text-xs text-muted-foreground">Record A</p><p className="font-medium">{c.labelA}</p><p className="text-[11px] text-muted-foreground">{c.recordIdA}</p></div>
          <div className="rounded-md border border-border p-2"><p className="text-xs text-muted-foreground">Record B</p><p className="font-medium">{c.labelB}</p><p className="text-[11px] text-muted-foreground">{c.recordIdB}</p></div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => dismissCandidate(actor, c.id).then(() => toast.success("Dismissed")).catch(() => toast.error("Failed"))}>Not a duplicate</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => merge(c.recordIdA, c.recordIdB)}><GitMerge className="size-4" /> Keep A, merge B→A</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => merge(c.recordIdB, c.recordIdA)}><GitMerge className="size-4" /> Keep B, merge A→B</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DuplicatesView() {
  const { userDoc } = useAuth();
  const { candidates, loading } = useDuplicateCandidates();
  const [scanning, setScanning] = useState(false);
  if (!userDoc) return null;
  const actor = { uid: userDoc.uid, role: userDoc.role };

  async function scan() {
    setScanning(true);
    try {
      const r = await runDuplicateScan(actor);
      toast.success(`Scan complete — ${r.personCandidates} person + ${r.orgCandidates} org candidate(s)`);
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Duplicate identities (IDM-02)</CardTitle>
            <CardDescription>Detect person/organisation records that may be the same identity, and merge under review.</CardDescription>
          </div>
          <Button size="sm" onClick={scan} disabled={scanning}><ScanSearch className="size-4" /> {scanning ? "Scanning…" : "Run scan"}</Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Merge reassigns all references to the survivor and tombstones the other record (never deleted). Merge execution runs server-side and requires the Blaze deploy.</p>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : candidates.length === 0 ? <p className="text-sm text-muted-foreground">No open duplicate candidates. Run a scan to check.</p>
        : candidates.map((c) => <CandidateCard key={c.id} c={c} actor={actor} />)}
    </div>
  );
}
