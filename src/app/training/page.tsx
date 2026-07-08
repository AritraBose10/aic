import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { TrainingView } from "@/features/training/components/TrainingView";

export default function TrainingPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "cohort_manager", "founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Training</h1>
        <TrainingView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
