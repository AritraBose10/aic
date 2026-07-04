import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { StartupWorkspace } from "@/features/startups/components/StartupWorkspace";

export default function StartupPage() {
  return (
    <ProtectedRoute allowedRoles={["founder"]}>
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <StartupWorkspace />
      </div>
    </ProtectedRoute>
  );
}
