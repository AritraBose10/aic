import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AssignedApplicationsList } from "@/features/applications/components/AssignedApplicationsList";

export default function EvaluatePage() {
  return (
    <ProtectedRoute allowedRoles={["evaluator"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Assigned applications</h1>
        <AssignedApplicationsList />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
