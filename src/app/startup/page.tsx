import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { StartupWorkspace } from "@/features/startups/components/StartupWorkspace";

export default function StartupPage() {
  return (
    <ProtectedRoute allowedRoles={["founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <StartupWorkspace />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
