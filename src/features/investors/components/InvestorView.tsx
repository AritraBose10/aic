"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorDisclaimer } from "@/components/InvestorDisclaimer";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { can } from "@/core/roles/permissions";
import { useInvestorProfile } from "@/features/investors/hooks/useInvestor";
import { saveInvestorProfile } from "@/features/investors/lib/investorActions";
import { useStartupInvestorProfilesByStatus } from "@/features/investorProfiles/hooks/useStartupInvestorProfiles";
import { reviewStartupInvestorProfile } from "@/features/investorProfiles/lib/investorProfileActions";
import { requestDataRoomAccess } from "@/features/dataRooms/lib/dataRoomActions";
import { useDataRoomRequests, useMyAccessibleDocuments } from "@/features/dataRooms/hooks/useDataRooms";
import { Badge } from "@/components/ui/badge";

const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function InvestorSelfProfile() {
  const { userDoc } = useAuth();
  const { profile } = useInvestorProfile(userDoc?.uid);
  const [name, setName] = useState("");
  const [sectors, setSectors] = useState("");
  const [tMin, setTMin] = useState("");
  const [tMax, setTMax] = useState("");
  const [geos, setGeos] = useState("");
  const [stages, setStages] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [busy, setBusy] = useState(false);
  const seededRef = useRef(false);

  // Seed the form once from the loaded profile (effect, not render-phase setState).
  useEffect(() => {
    if (!profile || seededRef.current) return;
    seededRef.current = true;
    setName(profile.name); setSectors(profile.sectors.join(", "));
    setTMin(String(profile.ticketMinLakh)); setTMax(String(profile.ticketMaxLakh));
    setGeos(profile.geographies.join(", ")); setStages(profile.stagePreferences.join(", "));
    setPortfolio(profile.portfolio);
  }, [profile]);

  async function save() {
    if (!userDoc || !name.trim()) return;
    setBusy(true);
    try {
      await saveInvestorProfile({ uid: userDoc.uid, role: userDoc.role }, {
        name, sectors: csv(sectors), ticketMinLakh: Number(tMin) || 0, ticketMaxLakh: Number(tMax) || 0,
        geographies: csv(geos), stagePreferences: csv(stages), portfolio, languages: [], engagement: "active",
      });
      toast.success("Profile saved");
    } catch { toast.error("Could not save"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Your investor profile</CardTitle>
        <CardDescription>Sector interests, ticket range, and stage preferences.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Sectors (comma-sep)</Label><Input value={sectors} onChange={(e) => setSectors(e.target.value)} /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Ticket min (₹ lakh)</Label><Input type="number" value={tMin} onChange={(e) => setTMin(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Ticket max (₹ lakh)</Label><Input type="number" value={tMax} onChange={(e) => setTMax(e.target.value)} /></div>
        </div>
        <div className="space-y-1"><Label className="text-xs">Geographies (comma-sep)</Label><Input value={geos} onChange={(e) => setGeos(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Stage preferences (comma-sep)</Label><Input value={stages} onChange={(e) => setStages(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Portfolio</Label><Textarea rows={2} value={portfolio} onChange={(e) => setPortfolio(e.target.value)} /></div>
        <div className="flex justify-end"><Button onClick={save} disabled={busy || !name.trim()}>Save profile</Button></div>
      </CardContent>
    </Card>
  );
}

function Discovery() {
  const { userDoc } = useAuth();
  const { profiles, loading } = useStartupInvestorProfilesByStatus("published");
  const actor = userDoc ? { uid: userDoc.uid, role: userDoc.role, name: userDoc.name } : null;
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Discover startups</CardTitle>
        <CardDescription>Published, admin-reviewed investor-facing profiles. Request data-room access to see documents.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : profiles.length === 0 ? <p className="text-sm text-muted-foreground">No published startups yet.</p>
          : profiles.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm">
              <div>
                <p className="font-medium">{p.startupName}</p>
                <p className="text-muted-foreground">{p.pitch}</p>
                <p className="mt-1 text-xs text-muted-foreground">Ask: ₹{p.fundingAskLakh} lakh · {p.traction}</p>
              </div>
              {actor && (
                <Button size="sm" variant="outline" className="shrink-0" disabled={!!requested[p.startupId]}
                  onClick={() => {
                    setRequested((r) => ({ ...r, [p.startupId]: true }));
                    requestDataRoomAccess(actor, { startupId: p.startupId, founderId: p.founderId, startupName: p.startupName }, "Requesting data-room access.")
                      .then(() => toast.success("Access requested"))
                      .catch(() => { toast.error("Failed"); setRequested((r) => ({ ...r, [p.startupId]: false })); });
                  }}>
                  {requested[p.startupId] ? "Requested" : "Request access"}
                </Button>
              )}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function StaffReview() {
  const { userDoc } = useAuth();
  const { profiles } = useStartupInvestorProfilesByStatus("in_review");
  const actor = userDoc ? { uid: userDoc.uid, role: userDoc.role } : null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Profiles awaiting review</CardTitle>
        <CardDescription>Publish makes a profile discoverable by verified investors.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {profiles.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in review.</p>
          : profiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <div><p className="font-medium">{p.startupName}</p><p className="text-xs text-muted-foreground">Ask ₹{p.fundingAskLakh} lakh</p></div>
              {actor && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => reviewStartupInvestorProfile(actor, p.id, false).then(() => toast.success("Sent back")).catch(() => toast.error("Failed"))}>Return</Button>
                  <Button size="sm" onClick={() => reviewStartupInvestorProfile(actor, p.id, true).then(() => toast.success("Published")).catch(() => toast.error("Failed"))}>Publish</Button>
                </div>
              )}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

const DR_STATUS_STYLE: Record<string, string> = {
  requested: "bg-muted text-muted-foreground",
  approved: "bg-success/10 text-success",
  denied: "bg-destructive/10 text-destructive",
};

function InvestorAccess({ uid }: { uid: string }) {
  const requests = useDataRoomRequests({ investorUid: uid });
  const docs = useMyAccessibleDocuments(uid);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My data-room access</CardTitle>
        <CardDescription>Your access requests and the documents you can currently view.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requests</p>
          {requests.length === 0 ? (
            <p className="text-muted-foreground">No requests yet — request access from a startup above.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="font-medium">{r.startupName}</span>
                <Badge variant="secondary" className={DR_STATUS_STYLE[r.status]}>{r.status}</Badge>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents you can view</p>
          {docs.length === 0 ? (
            <p className="text-muted-foreground">No documents shared with you yet.</p>
          ) : (
            docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>{d.title}</span>
                {d.downloadUrl ? (
                  <a href={d.downloadUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Open</a>
                ) : (
                  <span className="text-xs text-muted-foreground">no file</span>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function InvestorView() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;
  const isInvestor = userDoc.role === "investor";
  const isStaff = userDoc.role === "admin" || userDoc.role === "cohort_manager";
  const verified = userDoc.identityStatus === "verified";

  return (
    <div className="space-y-6">
      <InvestorDisclaimer />
      {isStaff && <StaffReview />}
      {isInvestor && (
        <>
          {!verified && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <ShieldAlert className="size-4 text-amber-600" />
              Your account is pending admin verification. Discovery unlocks once verified.
            </div>
          )}
          <InvestorSelfProfile />
          {verified && can(userDoc.role, "investor:discover") && (
            <>
              <div className="flex items-center gap-2 text-xs text-success"><ShieldCheck className="size-4" /> Verified investor</div>
              <Discovery />
              <InvestorAccess uid={userDoc.uid} />
            </>
          )}
        </>
      )}
    </div>
  );
}
