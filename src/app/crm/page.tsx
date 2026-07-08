import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { CrmView } from "@/features/crm/components/CrmView";

export default function CrmPage() {
  return (
    <ProtectedRoute allowedRoles={["founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">CRM</h1>
        <CrmView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
