import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { InvestorView } from "@/features/investors/components/InvestorView";

export default function InvestorPage() {
  return (
    <ProtectedRoute allowedRoles={["investor", "admin", "cohort_manager"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Investor connect</h1>
        <InvestorView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
