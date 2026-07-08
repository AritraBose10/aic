import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { MyApplicationsList } from "@/features/applications/components/MyApplicationsList";

export default function ApplicationsPage() {
  return (
    <ProtectedRoute allowedRoles={["founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">My applications</h1>
        <MyApplicationsList />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
