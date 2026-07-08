import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AccountView } from "@/features/account/components/AccountView";

export default function AccountPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">Account &amp; security</h1>
          <AccountView />
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
