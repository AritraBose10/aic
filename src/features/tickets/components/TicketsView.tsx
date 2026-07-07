"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTickets } from "@/core/tickets/useTickets";
import { useDirectory } from "@/features/directory/hooks/useDirectory";
import { assignTicket, setTicketStatus, addTicketNote, rateTicket } from "@/core/tickets";
import type { TicketDoc, TicketKind, TicketStatus, Role } from "@/core/types";

type Actor = { uid: string; role: Role; name: string };

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-accent text-accent-foreground",
  assigned: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  in_progress: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  escalated: "bg-destructive/10 text-destructive",
};

const NEXT_STATUS: Record<string, TicketStatus[]> = {
  open: ["in_progress", "escalated"],
  assigned: ["in_progress", "escalated"],
  in_progress: ["resolved", "escalated"],
  resolved: [],
  closed: [],
  escalated: ["in_progress"],
};

function TicketCard({ ticket, actor }: { ticket: TicketDoc; actor: Actor }) {
  const [note, setNote] = useState("");
  // Capture "now" once per mount — avoids an impure Date.now() call during render.
  const [now] = useState(() => Date.now());
  const isStaff = actor.role === "admin" || actor.role === "cohort_manager";
  const isProvider = ticket.providerId === actor.uid;
  const isRequester = ticket.requesterId === actor.uid;
  const canWork = isStaff || isProvider;
  const providers = useDirectory("provider", true);

  const overdue =
    ticket.slaDueAt && ticket.status !== "resolved" && ticket.status !== "closed"
      ? ticket.slaDueAt.toMillis() < now
      : false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{ticket.title}</CardTitle>
          <CardDescription>
            {ticket.category} · {ticket.urgency} urgency
            {ticket.providerName ? ` · ${ticket.providerName}` : ""}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="secondary" className={STATUS_STYLE[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
          {overdue && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="size-3" /> SLA overdue
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{ticket.requiredOutcome}</p>
        {ticket.slaDueAt && (
          <p className="text-xs text-muted-foreground">
            SLA due {ticket.slaDueAt.toDate().toLocaleDateString()}
          </p>
        )}

        {ticket.notes.length > 0 && (
          <div className="space-y-1 rounded-md border border-border p-2">
            {ticket.notes.map((n, i) => (
              <p key={i} className="text-xs">
                <span className="font-medium">{n.authorName}:</span> {n.body}
              </p>
            ))}
          </div>
        )}

        {ticket.status !== "closed" && (
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
            <Button size="sm" variant="outline" disabled={!note.trim()}
              onClick={() => addTicketNote(actor, ticket.id, note).then(() => setNote("")).catch(() => toast.error("Failed"))}>
              Note
            </Button>
          </div>
        )}

        {isStaff && ticket.status === "open" && providers.entries.length > 0 && (
          <div className="space-y-1">
            <Select onValueChange={(v) => {
              const p = providers.entries.find((e) => e.id === v);
              if (p) assignTicket(actor, ticket.id, p.contactUserId ?? p.id, p.name).then(() => toast.success("Assigned")).catch(() => toast.error("Failed"));
            }}>
              <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Assign to provider…" /></SelectTrigger>
              <SelectContent>
                {providers.entries.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {canWork && NEXT_STATUS[ticket.status].length > 0 && (
          <div className="flex flex-wrap gap-2">
            {NEXT_STATUS[ticket.status].map((s) => (
              <Button key={s} size="sm" variant={s === "escalated" ? "destructive" : "outline"}
                onClick={() => setTicketStatus(actor, ticket.id, s).then(() => toast.success(s.replace("_", " "))).catch(() => toast.error("Failed"))}>
                {s.replace("_", " ")}
              </Button>
            ))}
          </div>
        )}

        {isRequester && ticket.status === "resolved" && !ticket.rating && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rate & close:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={`Rate ${n}`} className="text-muted-foreground hover:text-amber-500"
                onClick={() => rateTicket(actor, ticket.id, n, "").then(() => toast.success("Thanks!")).catch(() => toast.error("Failed"))}>
                <Star className="size-5" />
              </button>
            ))}
          </div>
        )}
        {ticket.rating && (
          <p className="flex items-center gap-1 text-amber-600"><Star className="size-4 fill-current" /> {ticket.rating}/5</p>
        )}
      </CardContent>
    </Card>
  );
}

function List({ tickets, actor, empty }: { tickets: TicketDoc[]; actor: Actor; empty: string }) {
  if (tickets.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <div className="space-y-3">{tickets.map((t) => <TicketCard key={t.id} ticket={t} actor={actor} />)}</div>;
}

function StaffTickets({ kind, actor }: { kind: TicketKind; actor: Actor }) {
  const { tickets } = useTickets({ kind });
  return <List tickets={tickets} actor={actor} empty="No tickets yet." />;
}

/** Role-aware ticket list of a given kind. */
export function TicketsView({ kind }: { kind: TicketKind }) {
  const { userDoc } = useAuth();
  const mine = useTickets({ kind, requesterId: userDoc?.uid });
  const assigned = useTickets({ providerId: userDoc?.uid });
  if (!userDoc) return null;

  const actor: Actor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };
  const isStaff = userDoc.role === "admin" || userDoc.role === "cohort_manager";
  if (isStaff) return <StaffTickets kind={kind} actor={actor} />;

  const assignedKind = assigned.tickets.filter((t) => t.kind === kind);
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">My requests</h2>
        <List tickets={mine.tickets} actor={actor} empty="No requests yet." />
      </section>
      {assignedKind.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assigned to me</h2>
          <List tickets={assignedKind} actor={actor} empty="" />
        </section>
      )}
    </div>
  );
}
