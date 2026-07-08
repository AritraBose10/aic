import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { DuplicatesView } from "@/features/duplicates/components/DuplicatesView";

export default function DuplicatesPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "cohort_manager"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Duplicate identities</h1>
        <DuplicatesView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
