"use client";

import { GraduationCap, LifeBuoy, Star, Users, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMeetings } from "@/core/meetings/useMeetings";
import { useTickets } from "@/core/tickets/useTickets";
import { useEnrollments } from "@/features/training/hooks/useTraining";

function Tile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Ecosystem KPIs (KPI-04..KPI-07) wired from the Phase-2 features into the
 * Phase-1 dashboard — the AT-04 acceptance bar: mentor hours and ratings from
 * real bookings surface here, not just inside their own screens.
 */
export function EcosystemPanel() {
  const mentor = useMeetings({ kind: "mentor" });
  const fablab = useMeetings({ kind: "fablab" });
  const services = useTickets({ kind: "service" });
  const { enrollments } = useEnrollments({});

  const mentorDone = mentor.meetings.filter((m) => m.status === "completed");
  const mentorHours = Math.round(mentorDone.reduce((s, m) => s + (m.durationMinutes ?? 0), 0) / 60);
  const mentorRatings = mentorDone.map((m) => m.rating).filter((r): r is number => typeof r === "number");
  const mentorAvg = mentorRatings.length
    ? (mentorRatings.reduce((s, r) => s + r, 0) / mentorRatings.length).toFixed(1)
    : "—";

  const fablabDone = fablab.meetings.filter((m) => m.status === "completed");
  const fablabHours = Math.round(fablabDone.reduce((s, m) => s + (m.durationMinutes ?? 0), 0) / 60);

  const slaTracked = services.tickets.filter(
    (t) => (t.status === "resolved" || t.status === "closed") && t.slaDueAt,
  );
  const slaMet = slaTracked.filter((t) => (t.slaDueAt?.toMillis() ?? 0) >= (t.updatedAt?.toMillis() ?? 0));
  const slaPct = slaTracked.length ? Math.round((slaMet.length / slaTracked.length) * 100) : null;

  const completedEnroll = enrollments.filter((e) => e.status === "completed").length;
  const trainingPct = enrollments.length
    ? Math.round((completedEnroll / enrollments.length) * 100)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ecosystem support</CardTitle>
        <CardDescription>
          Training, mentoring, fab-lab, and service KPIs across the portfolio.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          icon={Users}
          label="Mentor hours"
          value={mentorHours}
          hint={`${mentorDone.length} sessions · avg ${mentorAvg}★`}
        />
        <Tile icon={Wrench} label="Fab-lab hours" value={fablabHours} hint={`${fablabDone.length} bookings`} />
        <Tile
          icon={LifeBuoy}
          label="Service SLA"
          value={slaPct === null ? "—" : `${slaPct}%`}
          hint={`${slaTracked.length} resolved`}
        />
        <Tile
          icon={GraduationCap}
          label="Training completion"
          value={trainingPct === null ? "—" : `${trainingPct}%`}
          hint={`${completedEnroll}/${enrollments.length} enrolments`}
        />
        <Tile
          icon={Star}
          label="Mentor rating"
          value={mentorAvg === "—" ? "—" : `${mentorAvg}/5`}
          hint={`${mentorRatings.length} rated`}
        />
      </CardContent>
    </Card>
  );
}
