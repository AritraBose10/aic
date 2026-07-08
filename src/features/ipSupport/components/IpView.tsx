"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { useTickets } from "@/core/tickets/useTickets";
import { setTicketStatus, addTicketNote, assignTicket } from "@/core/tickets";
import { useDirectory } from "@/features/directory/hooks/useDirectory";
import { can } from "@/core/roles/permissions";
import { useIpCases } from "@/features/ipSupport/hooks/useIpCases";
import { openIpCase, setIpCaseFeeCredits } from "@/features/ipSupport/lib/ipActions";
import { IP_CASE_TYPE_LABELS, type IpCaseType, type TicketDoc, type TicketStatus } from "@/core/types";

const STAGE_STYLE: Record<string, string> = {
  open: "bg-accent text-accent-foreground",
  assigned: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  in_progress: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  escalated: "bg-destructive/10 text-destructive",
};

function FounderIntake({ startupId, founderId }: { startupId: string; founderId: string }) {
  const { userDoc } = useAuth();
  const [ipType, setIpType] = useState<IpCaseType>("patent");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!userDoc || !title.trim()) return;
    setBusy(true);
    try {
      await openIpCase(
        { uid: userDoc.uid, role: userDoc.role, name: userDoc.name },
        { startupId, founderId },
        { ipType, title, description },
      );
      toast.success("IP case opened");
      setTitle(""); setDescription("");
    } catch {
      toast.error("Could not open case");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Open an IP case</CardTitle>
        <CardDescription>Patent, trademark, design, copyright, or confidentiality support.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={ipType} onValueChange={(v) => setIpType((v ?? "patent") as IpCaseType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(IP_CASE_TYPE_LABELS) as IpCaseType[]).map((t) => (
                  <SelectItem key={t} value={t}>{IP_CASE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Describe what you need</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy || !title.trim()}><Plus className="size-4" /> Open case</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CaseCard({ ticket, feeCredits, manage }: { ticket: TicketDoc; feeCredits: number; manage: boolean }) {
  const { userDoc } = useAuth();
  const providers = useDirectory("provider", true);
  const [note, setNote] = useState("");
  const [fee, setFee] = useState(String(feeCredits));
  const actor = userDoc ? { uid: userDoc.uid, role: userDoc.role, name: userDoc.name } : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{ticket.title}</CardTitle>
          <CardDescription>
            {IP_CASE_TYPE_LABELS[ticket.category as IpCaseType] ?? ticket.category}
            {ticket.providerName ? ` · counsel: ${ticket.providerName}` : ""}
            {ticket.slaDueAt ? ` · due ${ticket.slaDueAt.toDate().toLocaleDateString()}` : ""}
          </CardDescription>
        </div>
        <Badge variant="secondary" className={STAGE_STYLE[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{ticket.requiredOutcome}</p>
        {ticket.notes.length > 0 && (
          <div className="space-y-1 rounded-md border border-border p-2">
            {ticket.notes.map((n, i) => (
              <p key={i} className="text-xs"><span className="font-medium">{n.authorName}:</span> {n.body}</p>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Fee credits: {feeCredits}</p>

        {manage && actor && (
          <div className="space-y-2 rounded-md border border-border p-2">
            {ticket.status === "open" && providers.entries.length > 0 && (
              <Select onValueChange={(v) => {
                const p = providers.entries.find((e) => e.id === v);
                if (p) assignTicket(actor, ticket.id, p.contactUserId ?? p.id, p.name).then(() => toast.success("Counsel assigned")).catch(() => toast.error("Failed"));
              }}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Assign counsel…" /></SelectTrigger>
                <SelectContent>{providers.entries.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="flex flex-wrap gap-2">
              {(["in_progress", "resolved", "escalated"] as TicketStatus[]).map((s) => (
                <Button key={s} size="sm" variant={s === "escalated" ? "destructive" : "outline"}
                  onClick={() => setTicketStatus(actor, ticket.id, s).then(() => toast.success(s)).catch(() => toast.error("Failed"))}>
                  {s.replace("_", " ")}
                </Button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
              <Button size="sm" variant="outline" disabled={!note.trim()}
                onClick={() => addTicketNote(actor, ticket.id, note).then(() => setNote("")).catch(() => toast.error("Failed"))}>Note</Button>
            </div>
            <div className="flex items-end gap-2">
              <Input type="number" min={0} className="w-28" value={fee} onChange={(e) => setFee(e.target.value)} />
              <Button size="sm" variant="outline"
                onClick={() => setIpCaseFeeCredits(actor, ticket.id, Number(fee) || 0).then(() => toast.success("Fee updated")).catch(() => toast.error("Failed"))}>
                Set fee credits
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function IpView() {
  const { userDoc } = useAuth();
  const { startup } = useMyStartup(userDoc?.uid);
  const isManager = userDoc ? can(userDoc.role, "ip:manage") : false;
  const isRequester = userDoc ? can(userDoc.role, "ip:request") : false;
  const tickets = useTickets(isManager ? { kind: "ip" } : { kind: "ip", requesterId: userDoc?.uid });
  const { byTicketId } = useIpCases(isManager ? undefined : userDoc?.uid);

  if (!userDoc) return null;

  return (
    <div className="space-y-6">
      {isRequester && startup && <FounderIntake startupId={startup.id} founderId={startup.founderId} />}
      {isRequester && !startup && (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">
          Create your startup profile to open IP cases.
        </CardContent></Card>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Scale className="size-4" /> IP cases
        </h2>
        {tickets.tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No IP cases yet.</p>
        ) : (
          tickets.tickets.map((t) => (
            <CaseCard key={t.id} ticket={t} feeCredits={byTicketId[t.id]?.feeCredits ?? 0} manage={isManager} />
          ))
        )}
      </section>
    </div>
  );
}
