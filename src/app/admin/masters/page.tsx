import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { MastersManager } from "@/features/admin/components/MastersManager";

export default function AdminMastersPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <MastersManager />
      </div>
    </ProtectedRoute>
  );
}
