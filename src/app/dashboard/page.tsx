import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { DashboardView } from "@/features/dashboard/components/DashboardView";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <DashboardView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
