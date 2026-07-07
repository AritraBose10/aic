"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { CourseManager } from "@/features/training/components/CourseManager";
import { TrainingCatalog } from "@/features/training/components/TrainingCatalog";

export function TrainingView() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;

  if (userDoc.role === "admin" || userDoc.role === "cohort_manager") {
    return <CourseManager />;
  }
  if (userDoc.role === "founder") {
    return <TrainingCatalog />;
  }
  return (
    <p className="text-sm text-muted-foreground">Training is managed by cohort staff and founders.</p>
  );
}
