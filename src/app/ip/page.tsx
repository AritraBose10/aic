import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { IpView } from "@/features/ipSupport/components/IpView";

export default function IpPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "cohort_manager", "founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">IP &amp; legal support</h1>
        <IpView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
