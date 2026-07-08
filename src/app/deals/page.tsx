import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { DealsView } from "@/features/dealPipeline/components/DealsView";

export default function DealsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "cohort_manager", "investor", "founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Deal pipeline</h1>
        <DealsView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
