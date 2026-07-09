"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorDisclaimer } from "@/components/InvestorDisclaimer";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { can } from "@/core/roles/permissions";
import { useMyStartupInvestorProfile } from "@/features/investorProfiles/hooks/useStartupInvestorProfiles";
import { saveStartupInvestorProfile } from "@/features/investorProfiles/lib/investorProfileActions";
import { useDataRoomRequests, useDataRoomAccessLog } from "@/features/dataRooms/hooks/useDataRooms";
import { decideDataRoomRequest } from "@/features/dataRooms/lib/dataRoomActions";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  published: "bg-success/10 text-success",
};

export function InvestorFacingProfileForm() {
  const { userDoc } = useAuth();
  const { startup, loading } = useMyStartup(userDoc?.uid);
  const { profile } = useMyStartupInvestorProfile(startup?.id);
  const [pitch, setPitch] = useState("");
  const [traction, setTraction] = useState("");
  const [team, setTeam] = useState("");
  const [financialSummary, setFinancialSummary] = useState("");
  const [fundingAsk, setFundingAsk] = useState("");
  const [useOfFunds, setUseOfFunds] = useState("");
  const [busy, setBusy] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!profile || seededRef.current) return;
    seededRef.current = true;
    setPitch(profile.pitch); setTraction(profile.traction); setTeam(profile.team);
    setFinancialSummary(profile.financialSummary); setFundingAsk(String(profile.fundingAskLakh));
    setUseOfFunds(profile.useOfFunds);
  }, [profile]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!userDoc || !startup) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Create your startup profile first.</CardContent></Card>;
  }
  if (!can(userDoc.role, "investor:publish_profile")) {
    return <p className="text-sm text-muted-foreground">Available to founders.</p>;
  }

  const owner = { startupId: startup.id, founderId: startup.founderId, startupName: startup.name };
  const actor = { uid: userDoc.uid, role: userDoc.role };
  const drActor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };
  const input = { pitch, traction, team, financialSummary, fundingAskLakh: Number(fundingAsk) || 0, useOfFunds, documentIds: profile?.documentIds ?? [] };

  async function save(submit: boolean) {
    if (!pitch.trim()) return;
    setBusy(true);
    try {
      await saveStartupInvestorProfile(actor, owner, input, submit);
      toast.success(submit ? "Submitted for review" : "Draft saved");
    } catch { toast.error("Could not save"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <InvestorDisclaimer />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Investor-facing profile</CardTitle>
            <CardDescription>Reviewed by the team before investors can discover it.</CardDescription>
          </div>
          {profile && <Badge variant="secondary" className={STATUS_STYLE[profile.status]}>{profile.status.replace("_", " ")}</Badge>}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Pitch</Label><Textarea rows={2} value={pitch} onChange={(e) => setPitch(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Traction</Label><Textarea rows={2} value={traction} onChange={(e) => setTraction(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Team</Label><Input value={team} onChange={(e) => setTeam(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Financial summary</Label><Textarea rows={2} value={financialSummary} onChange={(e) => setFinancialSummary(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Funding ask (₹ lakh)</Label><Input type="number" value={fundingAsk} onChange={(e) => setFundingAsk(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Use of funds</Label><Textarea rows={2} value={useOfFunds} onChange={(e) => setUseOfFunds(e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={busy || !pitch.trim()}>Save draft</Button>
            <Button onClick={() => save(true)} disabled={busy || !pitch.trim()}>Submit for review</Button>
          </div>
        </CardContent>
      </Card>

      <DataRoomPanel founderId={startup.founderId} actor={drActor} />
    </div>
  );
}

function DataRoomPanel({ founderId, actor }: { founderId: string; actor: { uid: string; role: import("@/core/types").Role; name: string } }) {
  const requests = useDataRoomRequests({ founderId });
  const log = useDataRoomAccessLog(founderId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data room access</CardTitle>
        <CardDescription>Approve investor requests; every grant and view is logged (INV-04).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-2">
          {requests.length === 0 ? <p className="text-muted-foreground">No access requests.</p>
            : requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-2">
                <div><span className="font-medium">{r.investorName}</span>
                  <Badge variant="secondary" className="ml-2">{r.status}</Badge></div>
                {r.status === "requested" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => decideDataRoomRequest(actor, r, false).then(() => toast.success("Denied")).catch(() => toast.error("Failed"))}>Deny</Button>
                    <Button size="sm" onClick={() => decideDataRoomRequest(actor, r, true).then(() => toast.success("Approved")).catch(() => toast.error("Failed"))}>Approve</Button>
                  </div>
                )}
              </div>
            ))}
        </div>
        {log.length > 0 && (
          <div className="rounded-md border border-border p-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Access log</p>
            {log
              .slice()
              .sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0))
              .map((l) => (
                <p key={l.id} className="text-xs text-muted-foreground">{l.action} · investor {l.investorUid.slice(0, 6)}… {l.at ? `· ${l.at.toDate().toLocaleDateString()}` : ""}</p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
