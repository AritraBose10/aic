"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvestorDisclaimer } from "@/components/InvestorDisclaimer";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useDeals } from "@/features/dealPipeline/hooks/useDeals";
import { createDealEntry, updateDealStage } from "@/features/dealPipeline/lib/dealActions";
import { DEAL_STAGES, DEAL_STAGE_LABELS, type DealStage, type StartupInvestorProfileDoc } from "@/core/types";

const STAGE_STYLE: Record<string, string> = {
  interest: "bg-accent text-accent-foreground",
  diligence: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  term: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  commitment: "bg-success/10 text-success",
  closed: "bg-success/10 text-success",
  dropped: "bg-muted text-muted-foreground",
};

/** Published profiles for the investor's deal picker — read directly (no cross-feature import). */
function usePublished() {
  const [profiles, setProfiles] = useState<StartupInvestorProfileDoc[]>([]);
  useEffect(() => {
    const q = query(collection(db, "startupInvestorProfiles"), where("status", "==", "published"));
    return onSnapshot(q, (snap) => setProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StartupInvestorProfileDoc)), () => setProfiles([]));
  }, []);
  return profiles;
}

export function DealsView() {
  const { userDoc } = useAuth();
  const viewer = userDoc ? { uid: userDoc.uid, role: userDoc.role } : undefined;
  const { deals, loading } = useDeals(viewer);
  const published = usePublished();
  const [pick, setPick] = useState("");
  const [tracking, setTracking] = useState(false);
  if (!userDoc) return null;
  const isInvestor = userDoc.role === "investor";
  const actor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };

  async function track() {
    const p = published.find((x) => x.id === pick);
    if (!p || tracking) return;
    // Don't create a second pipeline entry for a startup already tracked.
    if (deals.some((d) => d.startupId === p.startupId && d.investorUid === actor.uid)) {
      toast.info("You're already tracking this startup.");
      setPick("");
      return;
    }
    setTracking(true);
    try {
      await createDealEntry(actor, { startupId: p.startupId, startupName: p.startupName, founderId: p.founderId });
      toast.success("Deal tracked"); setPick("");
    } catch { toast.error("Failed"); }
    finally { setTracking(false); }
  }

  return (
    <div className="space-y-6">
      <InvestorDisclaimer />
      {isInvestor && (
        <Card>
          <CardHeader><CardTitle className="text-base">Track a new deal</CardTitle>
            <CardDescription>Pick a published startup to start a pipeline entry (label only).</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <Select value={pick} onValueChange={(v) => setPick(v ?? "")}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Choose a startup…" /></SelectTrigger>
              <SelectContent>{published.map((p) => <SelectItem key={p.id} value={p.id}>{p.startupName}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={track} disabled={!pick || tracking}><Plus className="size-4" /> Track</Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><TrendingUp className="size-4" /> Deal pipeline</h2>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : deals.length === 0 ? <p className="text-sm text-muted-foreground">No deals yet.</p>
          : deals.map((d) => (
            <Card key={d.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle className="text-base">{d.startupName}</CardTitle>
                  <CardDescription>investor {d.investorName}</CardDescription></div>
                <Badge variant="secondary" className={STAGE_STYLE[d.stage]}>{DEAL_STAGE_LABELS[d.stage]}</Badge>
              </CardHeader>
              <CardContent>
                <Select value={d.stage} onValueChange={(v) => updateDealStage(actor, d.id, (v ?? d.stage) as DealStage).then(() => toast.success("Stage updated")).catch(() => toast.error("Failed"))}>
                  <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEAL_STAGES.map((s) => <SelectItem key={s} value={s}>{DEAL_STAGE_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
      </section>
    </div>
  );
}
