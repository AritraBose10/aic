import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AdoptionWorkspaceView } from "@/features/adoptionWorkspace/components/AdoptionWorkspaceView";
import { ImpactDashboards } from "@/features/impactDashboards/components/ImpactDashboards";

export default function AdoptionWorkspacePage() {
  return (
    <ProtectedRoute allowedRoles={["probasi_adopter", "founder", "admin", "cohort_manager"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10">
        <div>
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">Adoption workspace</h1>
          <AdoptionWorkspaceView />
        </div>
        <ImpactDashboards />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
