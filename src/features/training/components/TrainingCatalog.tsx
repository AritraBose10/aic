"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Circle, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { useCourses, useEnrollments } from "@/features/training/hooks/useTraining";
import {
  enrollStartup,
  setAttendance,
  submitAssignment,
} from "@/features/training/lib/trainingActions";
import { TRAINING_TRACK_LABELS, type CourseDoc, type EnrollmentDoc } from "@/core/types";

function EnrollmentCard({ enrollment, course }: { enrollment: EnrollmentDoc; course?: CourseDoc }) {
  const [assignmentUrl, setAssignmentUrl] = useState(enrollment.assignmentUrl ?? "");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{enrollment.courseTitle}</CardTitle>
          <CardDescription>{TRAINING_TRACK_LABELS[enrollment.track]}</CardDescription>
        </div>
        <Badge
          variant="secondary"
          className={
            enrollment.status === "completed" ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"
          }
        >
          {enrollment.status.replace("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {course && course.sessions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Sessions & attendance</p>
            {course.sessions.map((s) => {
              const attended = enrollment.attendedSessionIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  disabled={enrollment.status === "completed"}
                  onClick={() => setAttendance(enrollment.id, s.id, !attended).catch(() => toast.error("Could not update"))}
                  className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {attended ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                  <span className="flex-1">{s.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.scheduledAt.toDate().toLocaleDateString()}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Assignment link</label>
            <Input
              value={assignmentUrl}
              onChange={(e) => setAssignmentUrl(e.target.value)}
              placeholder="https://…"
              disabled={enrollment.status === "completed"}
            />
          </div>
          <Button
            variant="outline"
            disabled={enrollment.status === "completed" || !assignmentUrl.trim()}
            onClick={() =>
              submitAssignment(enrollment.id, assignmentUrl)
                .then(() => toast.success("Assignment submitted"))
                .catch(() => toast.error("Could not submit"))
            }
          >
            Submit
          </Button>
        </div>

        {enrollment.assessmentScore !== undefined && (
          <p className="text-sm">
            Assessment: <span className="font-medium">{enrollment.assessmentScore}/100</span>
            {enrollment.feedback && (
              <span className="block text-muted-foreground">{enrollment.feedback}</span>
            )}
          </p>
        )}
        {enrollment.status === "completed" && (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <GraduationCap className="size-4" /> Certificate issued — see your document vault.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TrainingCatalog() {
  const { userDoc } = useAuth();
  const { startup } = useMyStartup(userDoc?.uid);
  const { courses, loading } = useCourses(true);
  const { enrollments } = useEnrollments({ startupId: startup?.id });
  const [busy, setBusy] = useState<string | null>(null);

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const coursesById = new Map(courses.map((c) => [c.id, c]));

  async function enroll(course: CourseDoc) {
    if (!userDoc || !startup) return;
    setBusy(course.id);
    try {
      await enrollStartup(
        { uid: userDoc.uid, role: userDoc.role },
        { id: course.id, title: course.title, track: course.track },
        startup,
      );
      toast.success("Enrolled");
    } catch {
      toast.error("Could not enroll");
    } finally {
      setBusy(null);
    }
  }

  if (!startup) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Create your startup profile first to enrol in training.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          My training
        </h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t enrolled in any courses yet.</p>
        ) : (
          <div className="space-y-3">
            {enrollments.map((e) => (
              <EnrollmentCard key={e.id} enrollment={e} course={coursesById.get(e.courseId)} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Course catalogue
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <BookOpen className="size-4" />
                  </span>
                  <CardTitle className="text-base">{course.title}</CardTitle>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="secondary">{TRAINING_TRACK_LABELS[course.track]}</Badge>
                    {course.sector && <Badge variant="outline">{course.sector}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{course.description}</p>
                  {enrolledCourseIds.has(course.id) ? (
                    <Badge variant="secondary" className="bg-success/10 text-success">
                      Enrolled
                    </Badge>
                  ) : (
                    <Button size="sm" disabled={busy === course.id} onClick={() => enroll(course)}>
                      Enrol
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {courses.length === 0 && (
              <p className="text-sm text-muted-foreground">No courses are open yet.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
