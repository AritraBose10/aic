import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { ApprovalQueue } from "@/features/auth/components/ApprovalQueue";
import { AppHeader } from "@/components/AppHeader";

export default function AdminApprovalsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <ApprovalQueue />
      </div>
    </ProtectedRoute>
  );
}
