import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { ScorecardForm } from "@/features/applications/components/ScorecardForm";

export default async function EvaluateApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  return (
    <ProtectedRoute allowedRoles={["evaluator"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <ScorecardForm applicationId={applicationId} />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
