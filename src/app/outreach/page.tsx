import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { OutreachView } from "@/features/outreach/components/OutreachView";

export default function OutreachPage() {
  return (
    <ProtectedRoute allowedRoles={["founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">AI outreach</h1>
        <OutreachView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
