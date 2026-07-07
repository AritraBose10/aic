import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { DashboardView } from "@/features/dashboard/components/DashboardView";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppHeader />
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <DashboardView />
      </div>
    </ProtectedRoute>
  );
}
