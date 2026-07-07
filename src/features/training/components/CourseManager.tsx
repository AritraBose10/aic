"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCourses, useEnrollments } from "@/features/training/hooks/useTraining";
import { createCourse, setCourseActive, recordAssessment, completeEnrollment } from "@/features/training/lib/trainingActions";
import { TRAINING_TRACK_LABELS, type CourseDoc, type TrainingTrack } from "@/core/types";

const TRACKS = Object.keys(TRAINING_TRACK_LABELS) as TrainingTrack[];

function CreateCourseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { userDoc } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [track, setTrack] = useState<TrainingTrack>("mandatory");
  const [sector, setSector] = useState("");
  const [sessions, setSessions] = useState<{ title: string; at: string }[]>([{ title: "", at: "" }]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!userDoc || !title.trim()) return;
    setBusy(true);
    try {
      await createCourse(
        { uid: userDoc.uid, role: userDoc.role },
        {
          title,
          description,
          track,
          sector: track === "sector" ? sector : undefined,
          sessions: sessions
            .filter((s) => s.title.trim() && s.at)
            .map((s) => ({ title: s.title, scheduledAt: new Date(s.at) })),
        },
      );
      toast.success("Course created");
      onOpenChange(false);
      setTitle(""); setDescription(""); setSector(""); setSessions([{ title: "", at: "" }]);
    } catch {
      toast.error("Could not create course");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Track</Label>
              <Select value={track} onValueChange={(v) => setTrack((v ?? "mandatory") as TrainingTrack)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRACKS.map((t) => (
                    <SelectItem key={t} value={t}>{TRAINING_TRACK_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {track === "sector" && (
              <div className="space-y-2">
                <Label>Sector</Label>
                <Input value={sector} onChange={(e) => setSector(e.target.value)} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Sessions</Label>
            {sessions.map((s, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Session title"
                  value={s.title}
                  onChange={(e) => setSessions((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                />
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    className="w-full sm:w-52"
                    value={s.at}
                    onChange={(e) => setSessions((prev) => prev.map((x, j) => (j === i ? { ...x, at: e.target.value } : x)))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setSessions((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setSessions((p) => [...p, { title: "", at: "" }])}>
              <Plus className="size-4" /> Add session
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !title.trim()}>Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CourseEnrollments({ course }: { course: CourseDoc }) {
  const { userDoc } = useAuth();
  const { enrollments } = useEnrollments({ courseId: course.id });
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  if (enrollments.length === 0) {
    return <p className="text-sm text-muted-foreground">No enrolments yet.</p>;
  }

  return (
    <div className="space-y-2">
      {enrollments.map((e) => (
        <div key={e.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Startup {e.startupId.slice(0, 6)}…</span>
            <Badge variant="secondary" className={e.status === "completed" ? "bg-success/10 text-success" : ""}>
              {e.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            Attended {e.attendedSessionIds.length}/{course.sessions.length} · Assignment:{" "}
            {e.assignmentUrl ? (
              <a href={e.assignmentUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">link</a>
            ) : "—"}
          </p>
          {e.status !== "completed" && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Input
                type="number" min={0} max={100} className="w-24"
                placeholder="Score"
                value={scores[e.id] ?? (e.assessmentScore?.toString() ?? "")}
                onChange={(ev) => setScores((p) => ({ ...p, [e.id]: ev.target.value }))}
              />
              <Input
                className="flex-1 min-w-40"
                placeholder="Feedback"
                value={feedbacks[e.id] ?? (e.feedback ?? "")}
                onChange={(ev) => setFeedbacks((p) => ({ ...p, [e.id]: ev.target.value }))}
              />
              <Button
                size="sm" variant="outline"
                onClick={() =>
                  userDoc &&
                  recordAssessment({ uid: userDoc.uid, role: userDoc.role }, e.id, Number(scores[e.id] ?? e.assessmentScore ?? 0), feedbacks[e.id] ?? e.feedback ?? "")
                    .then(() => toast.success("Assessment saved"))
                    .catch(() => toast.error("Failed"))
                }
              >
                Save
              </Button>
              <Button
                size="sm" variant="success"
                onClick={() =>
                  userDoc &&
                  completeEnrollment(
                    { uid: userDoc.uid, role: userDoc.role },
                    { id: e.id, courseTitle: e.courseTitle, startupId: e.startupId, founderId: e.founderId },
                  )
                    .then(() => toast.success("Completed — certificate issued"))
                    .catch(() => toast.error("Failed"))
                }
              >
                Complete + certify
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function CourseManager() {
  const { courses, loading } = useCourses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Training courses</CardTitle>
          <CardDescription>Curriculum, sessions, tracks, assessment and certification.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> New course
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses yet.</p>
        ) : (
          courses.map((course) => (
            <div key={course.id} className="rounded-md border border-border">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="font-medium">{course.title}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{TRAINING_TRACK_LABELS[course.track]}</Badge>
                    {!course.active && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                    <span className="text-xs text-muted-foreground">{course.sessions.length} sessions</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === course.id ? null : course.id)}>
                    {expanded === course.id ? "Hide" : "Enrolments"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCourseActive(course.id, !course.active)}>
                    {course.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
              {expanded === course.id && (
                <div className="border-t border-border p-3">
                  <CourseEnrollments course={course} />
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
      <CreateCourseDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}
