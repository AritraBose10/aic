import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { GraduationManager } from "@/features/graduation/components/GraduationManager";

export default function GraduationPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "cohort_manager"]}>
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <GraduationManager />
      </div>
    </ProtectedRoute>
  );
}
