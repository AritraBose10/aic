"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useAdopterProfile, useDiscoverableStartups, useAdoptionRequests } from "@/features/adoption/hooks/useAdoption";
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
  const [seeded, setSeeded] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);

  if (profile && !seeded) {
    setSeeded(true);
    setName(profile.name); setLocation(profile.location);
    setExpertise(profile.sectorExpertise.join(", ")); setLangs(profile.languages.join(", "));
    setModes(Object.fromEntries(profile.contributionModes.map((m) => [m, true])));
  }
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
  const startups = useDiscoverableStartups();
  const [modes, setModes] = useState<Record<string, boolean>>({});
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
        {startups.length === 0 ? <p className="text-sm text-muted-foreground">No published startups yet.</p>
          : startups.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm">
              <div><p className="font-medium">{s.startupName}</p><p className="text-muted-foreground">{s.pitch}</p></div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() =>
                requestAdoption(actor, { startupId: s.startupId, founderId: s.founderId, startupName: s.startupName }, MODES.filter((m) => modes[m]), "Interested in adopting.")
                  .then(() => toast.success("Adoption requested")).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))}>Request</Button>
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

export function AdoptionView() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;
  const isAdopter = userDoc.role === "probasi_adopter";
  const isFounder = userDoc.role === "founder";
  const verified = userDoc.identityStatus === "verified";

  return (
    <div className="space-y-6">
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
            </>
          )}
        </>
      )}
    </div>
  );
}
