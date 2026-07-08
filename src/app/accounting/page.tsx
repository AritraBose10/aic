import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AccountingView } from "@/features/accounting/components/AccountingView";

export default function AccountingPage() {
  return (
    <ProtectedRoute allowedRoles={["founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Accounting</h1>
        <AccountingView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
