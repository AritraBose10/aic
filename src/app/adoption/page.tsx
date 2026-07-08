import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AdoptionView } from "@/features/adoption/components/AdoptionView";

export default function AdoptionPage() {
  return (
    <ProtectedRoute allowedRoles={["probasi_adopter", "founder", "admin", "cohort_manager"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Adopt a Bengal startup</h1>
        <AdoptionView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
