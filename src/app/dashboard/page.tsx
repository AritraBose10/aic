import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { DashboardHome } from "@/features/dashboard/components/DashboardHome";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <DashboardHome />
      </div>
    </ProtectedRoute>
  );
}
