"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  useAdopterAccounts,
  useAdopterProfile,
  useAdoptionRequests,
  useAllAdoptionRequests,
  useDiscoverableStartups,
} from "@/features/adoption/hooks/useAdoption";
import { rejectIdentity, verifyIdentity } from "@/features/auth/lib/authActions";
import { saveAdopterProfile, recordAcknowledgements, requestAdoption, decideAdoption } from "@/features/adoption/lib/adoptionActions";
import { ADOPTION_MODE_LABELS, type AdoptionMode } from "@/core/types";

const MODES = Object.keys(ADOPTION_MODE_LABELS) as AdoptionMode[];
const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function AdopterSelf() {
  const { userDoc } = useAuth();
  const profile = useAdopterProfile(userDoc?.uid);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [expertise, setExpertise] = useState("");
  const [langs, setLangs] = useState("");
  const [modes, setModes] = useState<Record<string, boolean>>({});
  const seededRef = useRef(false);
  const [ackBusy, setAckBusy] = useState(false);

  useEffect(() => {
    if (!profile || seededRef.current) return;
    seededRef.current = true;
    setName(profile.name); setLocation(profile.location);
    setExpertise(profile.sectorExpertise.join(", ")); setLangs(profile.languages.join(", "));
    setModes(Object.fromEntries(profile.contributionModes.map((m) => [m, true])));
  }, [profile]);
  if (!userDoc) return null;
  const actor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Your adopter profile</CardTitle>
          <CardDescription>Location, expertise, languages, and how you want to contribute.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, country" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Sector expertise (comma-sep)</Label><Input value={expertise} onChange={(e) => setExpertise(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Languages (comma-sep)</Label><Input value={langs} onChange={(e) => setLangs(e.target.value)} /></div>
          <div className="space-y-1">
            <Label className="text-xs">Contribution modes</Label>
            <div className="grid grid-cols-2 gap-1">
              {MODES.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!modes[m]} onCheckedChange={() => setModes((p) => ({ ...p, [m]: !p[m] }))} />
                  {ADOPTION_MODE_LABELS[m]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled={!name.trim()} onClick={() =>
              saveAdopterProfile(actor, { name, location, sectorExpertise: csv(expertise), languages: csv(langs), availability: "", contributionModes: MODES.filter((m) => modes[m]) })
                .then(() => toast.success("Profile saved")).catch(() => toast.error("Failed"))}>Save profile</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Confidentiality &amp; disclosure acknowledgements</CardTitle>
          <CardDescription>Required (ABS-09) before you can request adoption or access sensitive data.</CardDescription></CardHeader>
        <CardContent>
          <Button variant="outline" disabled={ackBusy} onClick={() => {
            setAckBusy(true);
            recordAcknowledgements(actor).then(() => toast.success("Acknowledgements recorded")).catch(() => toast.error("Failed")).finally(() => setAckBusy(false));
          }}>Acknowledge COI, confidentiality, investment disclaimer & data-use</Button>
        </CardContent>
      </Card>
    </>
  );
}

function Discovery() {
  const { userDoc } = useAuth();
  const { profiles: startups, loading } = useDiscoverableStartups();
  const [modes, setModes] = useState<Record<string, boolean>>({});
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  if (!userDoc) return null;
  const actor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Discover startups to adopt</CardTitle>
        <CardDescription>Published Bengal startups. Pick modes, then request adoption.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <label key={m} className="flex items-center gap-1 text-xs">
              <Checkbox checked={!!modes[m]} onCheckedChange={() => setModes((p) => ({ ...p, [m]: !p[m] }))} />
              {ADOPTION_MODE_LABELS[m]}
            </label>
          ))}
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : startups.length === 0 ? <p className="text-sm text-muted-foreground">No published startups yet.</p>
          : startups.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm">
              <div><p className="font-medium">{s.startupName}</p><p className="text-muted-foreground">{s.pitch}</p></div>
              <Button size="sm" variant="outline" className="shrink-0" disabled={!!requested[s.startupId]} onClick={() => {
                setRequested((r) => ({ ...r, [s.startupId]: true }));
                requestAdoption(actor, { startupId: s.startupId, founderId: s.founderId, startupName: s.startupName }, MODES.filter((m) => modes[m]), "Interested in adopting.")
                  .then(() => toast.success("Adoption requested"))
                  .catch((e) => { toast.error(e instanceof Error ? e.message : "Failed"); setRequested((r) => ({ ...r, [s.startupId]: false })); });
              }}>{requested[s.startupId] ? "Requested" : "Request"}</Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function FounderRequests() {
  const { userDoc } = useAuth();
  const requests = useAdoptionRequests({ founderId: userDoc?.uid });
  if (!userDoc) return null;
  const actor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Adoption requests</CardTitle>
        <CardDescription>Accept to open a shared adoption workspace.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {requests.length === 0 ? <p className="text-sm text-muted-foreground">No requests.</p>
          : requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <div><p className="font-medium">{r.adopterName}</p>
                <p className="text-xs text-muted-foreground">{r.modes.map((m) => ADOPTION_MODE_LABELS[m]).join(", ")}</p></div>
              {r.status === "requested" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => decideAdoption(actor, r, "declined").then(() => toast.success("Declined")).catch(() => toast.error("Failed"))}>Decline</Button>
                  <Button size="sm" onClick={() => decideAdoption(actor, r, "accepted").then(() => toast.success("Accepted — workspace opened")).catch(() => toast.error("Failed"))}>Accept</Button>
                </div>
              ) : <Badge variant="secondary">{r.status}</Badge>}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

const REQ_STATUS_STYLE: Record<string, string> = {
  requested: "bg-muted text-muted-foreground",
  accepted: "bg-success/10 text-success",
  declined: "bg-destructive/10 text-destructive",
  negotiating: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

function AdopterRequests({ uid }: { uid: string }) {
  const requests = useAdoptionRequests({ adopterUid: uid });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Your adoption requests</CardTitle>
        <CardDescription>Track the status of startups you&apos;ve offered to adopt.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {requests.length === 0 ? <p className="text-sm text-muted-foreground">You haven&apos;t requested any adoptions yet.</p>
          : requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <div><p className="font-medium">{r.startupName}</p>
                <p className="text-xs text-muted-foreground">{r.modes.map((m) => ADOPTION_MODE_LABELS[m]).join(", ")}</p></div>
              <Badge variant="secondary" className={REQ_STATUS_STYLE[r.status]}>{r.status}</Badge>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

const IDENTITY_STYLE: Record<string, string> = {
  verified: "bg-success/10 text-success",
  pending_verification: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  unverified: "bg-muted text-muted-foreground",
};

/**
 * Staff view (ABS-01, ABS-03/04 oversight): verify adopter identities — the
 * gate that unlocks discovery for them — and monitor every adoption request.
 * Only admins may change a user's identity status (users rule), so cohort
 * managers see the list read-only.
 */
function StaffOverview() {
  const { userDoc } = useAuth();
  const { adopters, loading: adoptersLoading } = useAdopterAccounts();
  const { requests, loading: requestsLoading } = useAllAdoptionRequests();
  const [busyUid, setBusyUid] = useState<string | null>(null);
  if (!userDoc) return null;
  const isAdmin = userDoc.role === "admin";
  const pending = adopters.filter((a) => a.approvalStatus === "approved" && a.identityStatus !== "verified");

  async function decide(uid: string, verify: boolean) {
    if (!userDoc) return;
    setBusyUid(uid);
    try {
      if (verify) await verifyIdentity(uid, userDoc.uid, userDoc.role);
      else await rejectIdentity(uid, userDoc.uid, userDoc.role, "Not verified by admin");
      toast.success(verify ? "Adopter verified" : "Verification rejected");
    } catch {
      toast.error("Could not update verification");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Adopter verification</CardTitle>
          <CardDescription>
            Approved adopters can only discover and request startups once their identity is verified.
            {!isAdmin && " Only admins can verify."}
          </CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {adoptersLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : adopters.length === 0 ? <p className="text-sm text-muted-foreground">No adopters have registered yet.</p>
            : adopters.map((a) => {
              const status = a.identityStatus ?? "unverified";
              const canDecide = isAdmin && a.approvalStatus === "approved" && status !== "verified";
              return (
                <div key={a.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                  <div><p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.email}{a.approvalStatus !== "approved" && ` · account ${a.approvalStatus}`}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={IDENTITY_STYLE[status]}>{status.replace("_", " ")}</Badge>
                    {canDecide && (
                      <>
                        {status === "pending_verification" && (
                          <Button size="sm" variant="outline" disabled={busyUid === a.uid} onClick={() => decide(a.uid, false)}>Reject</Button>
                        )}
                        <Button size="sm" disabled={busyUid === a.uid} onClick={() => decide(a.uid, true)}>
                          <ShieldCheck className="size-4" /> Verify
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          {pending.length > 0 && isAdmin && (
            <p className="text-xs text-muted-foreground">{pending.length} approved adopter{pending.length > 1 ? "s" : ""} awaiting verification.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All adoption requests</CardTitle>
          <CardDescription>Every request between adopters and startups, newest first.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {requestsLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : requests.length === 0 ? <p className="text-sm text-muted-foreground">No adoption requests yet.</p>
            : requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
                <div><p className="font-medium">{r.adopterName} → {r.startupName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.modes.map((m) => ADOPTION_MODE_LABELS[m]).join(", ")}
                    {r.createdAt && ` · ${r.createdAt.toDate().toLocaleDateString()}`}
                  </p></div>
                <Badge variant="secondary" className={REQ_STATUS_STYLE[r.status]}>{r.status}</Badge>
              </div>
            ))}
        </CardContent>
      </Card>
    </>
  );
}

export function AdoptionView() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;
  const isAdopter = userDoc.role === "probasi_adopter";
  const isFounder = userDoc.role === "founder";
  const isStaff = userDoc.role === "admin" || userDoc.role === "cohort_manager";
  const verified = userDoc.identityStatus === "verified";

  return (
    <div className="space-y-6">
      {isStaff && <StaffOverview />}
      {isFounder && <FounderRequests />}
      {isAdopter && (
        <>
          {!verified && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <ShieldAlert className="size-4 text-amber-600" /> Pending admin verification. Discovery unlocks once verified.
            </div>
          )}
          <AdopterSelf />
          {verified && (
            <>
              <div className="flex items-center gap-2 text-xs text-success"><ShieldCheck className="size-4" /> Verified adopter</div>
              <Discovery />
              <AdopterRequests uid={userDoc.uid} />
            </>
          )}
        </>
      )}
    </div>
  );
}
