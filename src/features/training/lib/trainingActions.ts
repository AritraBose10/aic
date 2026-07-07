import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import { issueGeneratedDocument } from "@/core/documents";
import type {
  CourseSession,
  EnrollmentStatus,
  Role,
  StartupDoc,
  TrainingTrack,
} from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
  name?: string;
}

// --- courses (staff) ---

export interface CourseInput {
  title: string;
  description: string;
  track: TrainingTrack;
  sector?: string;
  sessions: { title: string; scheduledAt: Date }[];
}

function toSessions(sessions: CourseInput["sessions"]): CourseSession[] {
  return sessions.map((s, i) => ({
    id: `s${i}_${s.scheduledAt.getTime()}`,
    title: s.title.trim(),
    scheduledAt: Timestamp.fromDate(s.scheduledAt),
  }));
}

export async function createCourse(actor: Actor, input: CourseInput): Promise<string> {
  const ref = await addDoc(collection(db, "courses"), {
    title: input.title.trim(),
    description: input.description.trim(),
    track: input.track,
    sector: input.track === "sector" ? (input.sector ?? null) : null,
    sessions: toSessions(input.sessions),
    active: true,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "training.enroll",
    entityType: "course",
    entityId: ref.id,
    details: { created: true, track: input.track },
  });
  return ref.id;
}

export async function setCourseActive(courseId: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "courses", courseId), { active, updatedAt: serverTimestamp() });
}

// --- enrollment (founder) ---

/** Deterministic id keeps enrollment idempotent (one per course+startup). */
function enrollmentId(courseId: string, startupId: string): string {
  return `${courseId}_${startupId}`;
}

export async function enrollStartup(
  actor: Actor,
  course: { id: string; title: string; track: TrainingTrack },
  startup: StartupDoc,
): Promise<string> {
  const id = enrollmentId(course.id, startup.id);
  const ref = doc(db, "enrollments", id);
  // Guard: don't overwrite an existing enrollment (that would wipe attendance).
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      courseId: course.id,
      courseTitle: course.title,
      track: course.track,
      startupId: startup.id,
      founderId: actor.uid,
      attendedSessionIds: [],
      status: "enrolled" satisfies EnrollmentStatus,
      enrolledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return id;
}

export async function setAttendance(
  enrollmentId_: string,
  sessionId: string,
  attended: boolean,
): Promise<void> {
  await updateDoc(doc(db, "enrollments", enrollmentId_), {
    attendedSessionIds: attended ? arrayUnion(sessionId) : arrayRemove(sessionId),
    status: "in_progress" satisfies EnrollmentStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function submitAssignment(enrollmentId_: string, url: string): Promise<void> {
  await updateDoc(doc(db, "enrollments", enrollmentId_), {
    assignmentUrl: url.trim(),
    status: "in_progress" satisfies EnrollmentStatus,
    updatedAt: serverTimestamp(),
  });
}

// --- assessment + completion (staff) ---

export async function recordAssessment(
  actor: Actor,
  enrollmentId_: string,
  score: number,
  feedback: string,
): Promise<void> {
  await updateDoc(doc(db, "enrollments", enrollmentId_), {
    assessmentScore: score,
    feedback: feedback.trim() || null,
    updatedAt: serverTimestamp(),
  });
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "training.complete",
    entityType: "course",
    entityId: enrollmentId_,
    details: { assessmentScore: score },
  });
}

/**
 * Mark an enrollment complete and issue the certificate into the document vault,
 * visible to the founder. LMS-01.
 */
export async function completeEnrollment(
  actor: Actor,
  enrollment: {
    id: string;
    courseTitle: string;
    startupId: string;
    founderId: string;
  },
): Promise<void> {
  const certificateDocId = await issueGeneratedDocument(actor, {
    ownerType: "startup",
    ownerId: enrollment.startupId,
    category: "certificate",
    title: `Certificate — ${enrollment.courseTitle}`,
    visibleTo: [enrollment.founderId],
  });

  await updateDoc(doc(db, "enrollments", enrollment.id), {
    status: "completed" satisfies EnrollmentStatus,
    certificateDocId,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "training.complete",
    entityType: "course",
    entityId: enrollment.id,
    details: { completed: true, certificateDocId },
  });
}
