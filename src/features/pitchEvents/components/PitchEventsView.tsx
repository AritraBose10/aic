"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestorDisclaimer } from "@/components/InvestorDisclaimer";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePitchEvents } from "@/features/pitchEvents/hooks/usePitchEvents";
import { createPitchEvent, updatePitchEvent, submitPitchFeedback } from "@/features/pitchEvents/lib/pitchEventActions";
import type { PitchEventDoc } from "@/core/types";

function StaffCreate({ actor }: { actor: { uid: string; role: import("@/core/types").Role; name: string } }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [at, setAt] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Create pitch event</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-40 space-y-1"><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">When</Label><Input type="datetime-local" className="w-52" value={at} onChange={(e) => setAt(e.target.value)} /></div>
        <div className="flex-1 min-w-40 space-y-1"><Label className="text-xs">Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <Button disabled={!title.trim() || !at} onClick={() =>
          createPitchEvent(actor, { title, description, at: new Date(at) })
            .then(() => { toast.success("Event created"); setTitle(""); setDescription(""); setAt(""); })
            .catch(() => toast.error("Failed"))}>
          <Plus className="size-4" /> Create
        </Button>
      </CardContent>
    </Card>
  );
}

function EventCard({ event, isStaff, isInvestor, actor }: {
  event: PitchEventDoc; isStaff: boolean; isInvestor: boolean;
  actor: { uid: string; role: import("@/core/types").Role; name: string };
}) {
  const [inviteUid, setInviteUid] = useState("");
  const [fbStartup, setFbStartup] = useState("");
  const [fbNote, setFbNote] = useState("");
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div><CardTitle className="text-base">{event.title}</CardTitle>
          <CardDescription>{event.at?.toDate().toLocaleString()} · {event.description}</CardDescription></div>
        <Badge variant="secondary">{event.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">{event.investorUids.length} investors invited · {event.shortlistStartupIds.length} shortlisted</p>
        {isStaff && (
          <div className="space-y-2 rounded-md border border-border p-2">
            <div className="flex flex-wrap gap-2">
              {(["draft", "open", "closed"] as const).map((s) => (
                <Button key={s} size="sm" variant={event.status === s ? "default" : "outline"}
                  onClick={() => updatePitchEvent(actor, event.id, { status: s }).catch(() => toast.error("Failed"))}>{s}</Button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Input value={inviteUid} onChange={(e) => setInviteUid(e.target.value)} placeholder="Invite investor uid" />
              <Button size="sm" variant="outline" disabled={!inviteUid.trim()}
                onClick={() => updatePitchEvent(actor, event.id, { investorUids: [...event.investorUids, inviteUid.trim()] }).then(() => setInviteUid("")).catch(() => toast.error("Failed"))}>Invite</Button>
            </div>
          </div>
        )}
        {isInvestor && event.status === "open" && (
          <div className="space-y-2 rounded-md border border-border p-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Leave feedback</p>
            <Input value={fbStartup} onChange={(e) => setFbStartup(e.target.value)} placeholder="Startup id" />
            <div className="flex items-end gap-2">
              <Input value={fbNote} onChange={(e) => setFbNote(e.target.value)} placeholder="Your feedback" />
              <Button size="sm" disabled={!fbNote.trim() || !fbStartup.trim()}
                onClick={() => submitPitchFeedback(actor, event.id, { startupId: fbStartup, note: fbNote }).then(() => { toast.success("Feedback sent"); setFbNote(""); }).catch(() => toast.error("Failed"))}>Send</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PitchEventsView() {
  const { userDoc } = useAuth();
  const viewer = userDoc ? { uid: userDoc.uid, role: userDoc.role } : undefined;
  const { events, loading } = usePitchEvents(viewer);
  if (!userDoc) return null;
  const isStaff = userDoc.role === "admin" || userDoc.role === "cohort_manager";
  const isInvestor = userDoc.role === "investor";
  const actor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };

  return (
    <div className="space-y-6">
      <InvestorDisclaimer />
      {isStaff && <StaffCreate actor={actor} />}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><CalendarDays className="size-4" /> Events</h2>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
          : events.length === 0 ? <p className="text-sm text-muted-foreground">No events.</p>
          : events.map((e) => <EventCard key={e.id} event={e} isStaff={isStaff} isInvestor={isInvestor} actor={actor} />)}
      </section>
    </div>
  );
}
