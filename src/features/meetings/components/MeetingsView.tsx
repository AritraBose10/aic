"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMeetings } from "@/core/meetings/useMeetings";
import { respondToMeeting, completeMeeting, rateMeeting } from "@/core/meetings";
import type { MeetingDoc, MeetingKind, Role } from "@/core/types";

type Actor = { uid: string; role: Role; name: string };

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-accent text-accent-foreground",
  scheduled: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  completed: "bg-success/10 text-success",
  rejected: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function SessionCard({ meeting, actor }: { meeting: MeetingDoc; actor: Actor }) {
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("60");
  const isStaff = actor.role === "admin" || actor.role === "cohort_manager";
  const canManage = meeting.hostId === actor.uid || isStaff;
  const isRequester = meeting.requesterId === actor.uid;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{meeting.topic}</CardTitle>
          <CardDescription>
            {meeting.resourceName ? `${meeting.resourceName} · ` : ""}with {meeting.hostName} ·
            requested {meeting.proposedAt?.toDate().toLocaleDateString()}
          </CardDescription>
        </div>
        <Badge variant="secondary" className={STATUS_STYLE[meeting.status]}>{meeting.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {meeting.scheduledAt && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="size-4" /> {meeting.scheduledAt.toDate().toLocaleString()}
          </p>
        )}

        {canManage && meeting.status === "requested" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Confirm time</Label>
              <Input type="datetime-local" className="w-52" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <Button size="sm" variant="success" disabled={!when}
              onClick={() => respondToMeeting(actor, meeting.id, true, new Date(when)).then(() => toast.success("Scheduled")).catch(() => toast.error("Failed"))}>
              Accept
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => respondToMeeting(actor, meeting.id, false).then(() => toast.success("Declined")).catch(() => toast.error("Failed"))}>
              Decline
            </Button>
          </div>
        )}

        {canManage && meeting.status === "scheduled" && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <Textarea rows={2} placeholder="Session notes / action items" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Duration (min)</Label>
                <Input type="number" min={0} className="w-28" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
              <Button size="sm"
                onClick={() => completeMeeting(actor, meeting.id, { notes, durationMinutes: Number(duration) }).then(() => toast.success("Completed")).catch(() => toast.error("Failed"))}>
                Mark completed
              </Button>
            </div>
          </div>
        )}

        {meeting.status === "completed" && (
          <>
            {meeting.notes && <p className="text-muted-foreground">{meeting.notes}</p>}
            <p className="text-muted-foreground">Duration: {meeting.durationMinutes ?? 0} min</p>
            {isRequester && !meeting.rating && (
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => rateMeeting(actor, meeting.id, n).then(() => toast.success("Rated")).catch(() => toast.error("Failed"))}
                    className="text-muted-foreground hover:text-amber-500" aria-label={`Rate ${n}`}>
                    <Star className="size-5" />
                  </button>
                ))}
              </div>
            )}
            {meeting.rating && (
              <p className="flex items-center gap-1 text-amber-600"><Star className="size-4 fill-current" /> {meeting.rating}/5</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, meetings, actor }: { title: string; meetings: MeetingDoc[]; actor: Actor }) {
  if (meetings.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {meetings.map((m) => <SessionCard key={m.id} meeting={m} actor={actor} />)}
    </section>
  );
}

function StaffMeetings({ kind, actor, emptyLabel }: { kind: MeetingKind; actor: Actor; emptyLabel: string }) {
  const { meetings } = useMeetings({ kind });
  if (meetings.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return <Section title={`All ${kind} bookings`} meetings={meetings} actor={actor} />;
}

/** Role-aware list of meetings of a given kind: staff see all; others see the
 *  ones they requested (to rate) and any they host (to respond/complete). */
export function MeetingsView({ kind, emptyLabel }: { kind: MeetingKind; emptyLabel: string }) {
  const { userDoc } = useAuth();
  const requested = useMeetings({ kind, requesterId: userDoc?.uid });
  const hosting = useMeetings({ hostId: userDoc?.uid });
  if (!userDoc) return null;

  const actor: Actor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };
  const isStaff = userDoc.role === "admin" || userDoc.role === "cohort_manager";
  const hostingKind = hosting.meetings.filter((m) => m.kind === kind);

  if (isStaff) return <StaffMeetings kind={kind} actor={actor} emptyLabel={emptyLabel} />;

  return (
    <div className="space-y-8">
      <Section title="My requests" meetings={requested.meetings} actor={actor} />
      <Section title="Hosting" meetings={hostingKind} actor={actor} />
      {requested.meetings.length === 0 && hostingKind.length === 0 && (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}
