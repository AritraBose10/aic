"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Sparkles, ShieldCheck, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { useConsents } from "@/core/consent/useConsents";
import { consentDocId } from "@/core/consent";
import { can } from "@/core/roles/permissions";
import { useCampaigns, useOutreachContacts } from "@/features/outreach/hooks/useCampaigns";
import {
  createCampaign,
  generateCampaignDraft,
  approveCampaign,
  sendCampaign,
  recordCampaignOutcome,
} from "@/features/outreach/lib/outreachActions";
import {
  OUTREACH_CHANNEL_LABELS,
  type CampaignDoc,
  type OutreachChannel,
  type StartupDoc,
} from "@/core/types";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  sent: "bg-success/10 text-success",
};

function CreateCampaignDialog({ startup, open, onOpenChange }: { startup: StartupDoc; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { userDoc } = useAuth();
  const contacts = useOutreachContacts(startup.id);
  const { byId: consents } = useConsents(startup.id);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [segment, setSegment] = useState("");
  const [valueProp, setValueProp] = useState("");
  const [goal, setGoal] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const owner = { startupId: startup.id, startupName: startup.name, founderId: startup.founderId };

  async function submit() {
    if (!userDoc || !name.trim() || !valueProp.trim()) return;
    const contactIds = Object.keys(selected).filter((k) => selected[k]);
    if (contactIds.length === 0) {
      toast.error("Select at least one contact");
      return;
    }
    setBusy(true);
    try {
      await createCampaign(
        { uid: userDoc.uid, role: userDoc.role },
        owner,
        { name, channel, brief: { segment, valueProp, goal }, contactIds },
      );
      toast.success("Campaign created");
      onOpenChange(false);
      setName(""); setSegment(""); setValueProp(""); setGoal(""); setSelected({});
    } catch {
      toast.error("Could not create campaign");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New outreach campaign</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel((v ?? "email") as OutreachChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(OUTREACH_CHANNEL_LABELS) as OutreachChannel[]).map((c) => (
                    <SelectItem key={c} value={c}>{OUTREACH_CHANNEL_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Target segment</Label>
            <Input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="e.g. mid-market retailers in Kolkata" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Value proposition</Label>
            <Textarea rows={2} value={valueProp} onChange={(e) => setValueProp(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Campaign goal</Label>
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. book a demo" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Recipients</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {contacts.length === 0 && <p className="text-xs text-muted-foreground">No contacts yet — add them in the CRM.</p>}
              {contacts.map((c) => {
                const consented = consents[consentDocId(c.id, "outreach")]?.granted === true;
                return (
                  <label key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Checkbox checked={!!selected[c.id]} onCheckedChange={() => setSelected((p) => ({ ...p, [c.id]: !p[c.id] }))} />
                      {c.name}
                    </span>
                    <Badge variant="secondary" className={consented ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                      {consented ? "consented" : "no consent"}
                    </Badge>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">Non-consented contacts are filtered out server-side before the AI sees them.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !name.trim() || !valueProp.trim()}>Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CampaignCard({ campaign, owner }: { campaign: CampaignDoc; owner: { startupId: string; startupName: string; founderId: string } }) {
  const { userDoc } = useAuth();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState({ sent: "", responses: "", meetings: "", conversions: "", salesValue: "" });
  const actor = userDoc ? { uid: userDoc.uid, role: userDoc.role } : null;
  if (!actor) return null;

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{campaign.name}</CardTitle>
          <CardDescription>{OUTREACH_CHANNEL_LABELS[campaign.channel]} · {campaign.brief.segment || "no segment"}</CardDescription>
        </div>
        <Badge variant="secondary" className={STATUS_STYLE[campaign.status]}>{campaign.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{campaign.brief.valueProp}</p>

        {campaign.draft ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="whitespace-pre-wrap">{campaign.draft}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="bg-success/10 text-success">
                <ShieldCheck className="size-3" /> {campaign.includedContactIds?.length ?? 0} consent-cleared
              </Badge>
              {(campaign.excludedContactIds?.length ?? 0) > 0 && (
                <Badge variant="outline" className="text-muted-foreground">{campaign.excludedContactIds!.length} filtered out</Badge>
              )}
              {campaign.draftModel && <span className="text-muted-foreground">via {campaign.draftModel}</span>}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No draft yet.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => run(() => generateCampaignDraft(actor, campaign), "Draft generated")}>
            <Sparkles className="size-4" /> {campaign.draft ? "Regenerate" : "Generate draft"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy || !campaign.draft || campaign.status !== "draft"}
            onClick={() => run(() => approveCampaign(actor, campaign), "Approved")}>
            <CheckCircle2 className="size-4" /> Approve
          </Button>
          <Button size="sm" disabled={busy || campaign.status === "sent"}
            onClick={() => run(() => sendCampaign(actor, campaign), "Sent")}>
            <Send className="size-4" /> Send
          </Button>
        </div>

        {campaign.status === "sent" && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Record outcome</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(["sent", "responses", "meetings", "conversions", "salesValue"] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-[11px] capitalize">{k === "salesValue" ? "sales ₹" : k}</Label>
                  <Input type="number" min={0} value={outcome[k]} onChange={(e) => setOutcome((p) => ({ ...p, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => recordCampaignOutcome(actor, owner, campaign, {
                  sent: Number(outcome.sent) || 0,
                  responses: Number(outcome.responses) || 0,
                  meetings: Number(outcome.meetings) || 0,
                  conversions: Number(outcome.conversions) || 0,
                  salesValue: Number(outcome.salesValue) || 0,
                }), "Outcome recorded")}>
                Save outcome
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OutreachView() {
  const { userDoc } = useAuth();
  const { startup, loading } = useMyStartup(userDoc?.uid);
  const { campaigns } = useCampaigns(startup?.id);
  const [open, setOpen] = useState(false);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!userDoc || !startup) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Create your startup profile first to run outreach.
      </CardContent></Card>
    );
  }
  if (!can(userDoc.role, "outreach:manage_own")) {
    return <p className="text-sm text-muted-foreground">AI outreach is available to founders.</p>;
  }

  const owner = { startupId: startup.id, startupName: startup.name, founderId: startup.founderId };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Draft with AI, review, and approve before anything is sent. Consent is enforced server-side.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> New campaign</Button>
      </div>
      <CreateCampaignDialog startup={startup} open={open} onOpenChange={setOpen} />

      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campaigns yet.</p>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} owner={owner} />)}
        </div>
      )}
    </div>
  );
}
