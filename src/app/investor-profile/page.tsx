import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { InvestorFacingProfileForm } from "@/features/investorProfiles/components/InvestorFacingProfileForm";

export default function InvestorProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Investor-facing profile</h1>
        <InvestorFacingProfileForm />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
