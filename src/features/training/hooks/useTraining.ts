"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CourseDoc, EnrollmentDoc } from "@/core/types";

/** All courses (admin view) or only active ones (catalog). Client-sorted by title. */
export function useCourses(activeOnly = false) {
  const [state, setState] = useState<{ courses: CourseDoc[]; loading: boolean }>({
    courses: [],
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "courses"),
      (snap) => {
        const courses = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CourseDoc)
          .filter((c) => !activeOnly || c.active)
          .sort((a, b) => a.title.localeCompare(b.title));
        setState({ courses, loading: false });
      },
      (error) => {
        console.error("courses listener error", error);
        setState({ courses: [], loading: false });
      },
    );
    return unsubscribe;
  }, [activeOnly]);

  return state;
}

interface EnrollmentFilter {
  startupId?: string;
  courseId?: string;
}

/** Enrollments by startup (founder view) or by course (staff assessment view). */
export function useEnrollments(filter: EnrollmentFilter) {
  const [state, setState] = useState<{ enrollments: EnrollmentDoc[]; loading: boolean }>({
    enrollments: [],
    loading: true,
  });

  const { startupId, courseId } = filter;

  useEffect(() => {
    const constraints = [];
    if (startupId) constraints.push(where("startupId", "==", startupId));
    if (courseId) constraints.push(where("courseId", "==", courseId));

    const unsubscribe = onSnapshot(
      query(collection(db, "enrollments"), ...constraints),
      (snap) => {
        const enrollments = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as EnrollmentDoc)
          .sort((a, b) => (b.enrolledAt?.toMillis() ?? 0) - (a.enrolledAt?.toMillis() ?? 0));
        setState({ enrollments, loading: false });
      },
      (error) => {
        console.error("enrollments listener error", error);
        setState({ enrollments: [], loading: false });
      },
    );
    return unsubscribe;
  }, [startupId, courseId]);

  return state;
}
