import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { ApprovalQueue } from "@/features/auth/components/ApprovalQueue";
import { AppLayout } from "@/components/AppLayout";

export default function AdminApprovalsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <ApprovalQueue />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
