"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { useDirectory } from "@/features/directory/hooks/useDirectory";
import { useConsents } from "@/core/consent/useConsents";
import { consentDocId } from "@/core/consent";
import { can } from "@/core/roles/permissions";
import { useContacts, useOpportunities, useOpsConfig } from "@/features/crm/hooks/useCrm";
import { createContact, createOpportunity, moveOpportunityStage, setOpsMode } from "@/features/crm/lib/crmActions";
import {
  OPS_MODE_LABELS,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type OpsMode,
  type PipelineStage,
  type StartupDoc,
} from "@/core/types";

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function ModeToggle({ startup }: { startup: StartupDoc }) {
  const { userDoc } = useAuth();
  const config = useOpsConfig(startup.id);
  const providers = useDirectory("provider", true);
  const owner = { startupId: startup.id, startupName: startup.name, founderId: startup.founderId };
  const crmMode = config?.crmMode ?? "built_in";

  async function set(mode: OpsMode) {
    if (!userDoc) return;
    try {
      await setOpsMode({ uid: userDoc.uid, role: userDoc.role, name: userDoc.name }, owner, { crmMode: mode });
    } catch {
      toast.error("Could not update mode");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">How you run CRM</CardTitle>
        <CardDescription>Use the built-in tools, integrate your own, or hand it to a provider.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Select value={crmMode} onValueChange={(v) => set((v ?? "built_in") as OpsMode)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(OPS_MODE_LABELS) as OpsMode[]).map((m) => (
              <SelectItem key={m} value={m}>{OPS_MODE_LABELS[m]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {crmMode === "managed" && (
          <Select
            value={config?.crmProviderId ?? ""}
            onValueChange={(v) =>
              userDoc && setOpsMode({ uid: userDoc.uid, role: userDoc.role, name: userDoc.name }, owner, { crmProviderId: v ?? "" })
            }
          >
            <SelectTrigger className="w-56"><SelectValue placeholder="Choose a provider…" /></SelectTrigger>
            <SelectContent>
              {providers.entries.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {crmMode !== "built_in" && (
          <p className="text-sm text-muted-foreground">Built-in pipeline is read-only in this mode.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function CrmView() {
  const { userDoc } = useAuth();
  const { startup, loading } = useMyStartup(userDoc?.uid);
  const config = useOpsConfig(startup?.id);
  const { contacts } = useContacts(startup?.id);
  const { opportunities } = useOpportunities(startup?.id);
  const { byId: consents } = useConsents(startup?.id);

  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cConsent, setCConsent] = useState(false);
  const [oTitle, setOTitle] = useState("");
  const [oValue, setOValue] = useState("");

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!userDoc || !startup) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Create your startup profile first to use the CRM.
        </CardContent>
      </Card>
    );
  }
  if (!can(userDoc.role, "crm:manage_own")) {
    return <p className="text-sm text-muted-foreground">The CRM is available to founders.</p>;
  }

  const owner = { startupId: startup.id, startupName: startup.name, founderId: startup.founderId };
  const actor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };
  const builtIn = (config?.crmMode ?? "built_in") === "built_in";

  async function addContact() {
    if (!cName.trim()) return;
    try {
      await createContact(actor, owner, { name: cName, email: cEmail, outreachConsent: cConsent });
      setCName(""); setCEmail(""); setCConsent(false);
      toast.success("Contact added");
    } catch {
      toast.error("Could not add contact");
    }
  }

  async function addOpp() {
    if (!oTitle.trim()) return;
    try {
      await createOpportunity(actor, owner, { title: oTitle, value: Number(oValue) || 0 });
      setOTitle(""); setOValue("");
      toast.success("Opportunity added");
    } catch {
      toast.error("Could not add opportunity");
    }
  }

  return (
    <div className="space-y-6">
      <ModeToggle startup={startup} />

      {/* Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales pipeline</CardTitle>
          <CardDescription>Move opportunities through stages; won/lost close them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {builtIn && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-40 space-y-1">
                <Label className="text-xs">Opportunity</Label>
                <Input value={oTitle} onChange={(e) => setOTitle(e.target.value)} placeholder="Deal name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value (₹)</Label>
                <Input type="number" min={0} className="w-32" value={oValue} onChange={(e) => setOValue(e.target.value)} />
              </div>
              <Button onClick={addOpp} disabled={!oTitle.trim()}><Plus className="size-4" /> Add</Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PIPELINE_STAGES.map((stage) => {
              const col = opportunities.filter((o) => o.stage === stage);
              return (
                <div key={stage} className="rounded-md border border-border bg-muted/30 p-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {PIPELINE_STAGE_LABELS[stage]} · {col.length}
                  </p>
                  <div className="space-y-2">
                    {col.map((o) => (
                      <div key={o.id} className="rounded-md border border-border bg-card p-2 text-sm">
                        <p className="font-medium">{o.title}</p>
                        <p className="text-xs text-muted-foreground">{inr(o.value)}</p>
                        {builtIn && (
                          <Select value={o.stage} onValueChange={(v) => moveOpportunityStage(actor, owner, o, (v ?? o.stage) as PipelineStage).catch(() => toast.error("Failed"))}>
                            <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts & leads</CardTitle>
          <CardDescription>Capture outreach consent when you add a contact.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {builtIn && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={cName} onChange={(e) => setCName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox checked={cConsent} onCheckedChange={() => setCConsent((v) => !v)} />
                Consented to outreach
              </label>
              <Button onClick={addContact} disabled={!cName.trim()}><Plus className="size-4" /> Add</Button>
            </div>
          )}
          <ul className="divide-y divide-border rounded-md border border-border">
            {contacts.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No contacts yet.</li>}
            {contacts.map((c) => {
              const consented = consents[consentDocId(c.id, "outreach")]?.granted === true;
              return (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.email ?? "no email"}
                      {c.contributedByUid !== c.founderId && c.contributedByName ? ` · via ${c.contributedByName}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className={consented ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                    <ShieldCheck className="size-3" /> {consented ? "Outreach OK" : "No consent"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
