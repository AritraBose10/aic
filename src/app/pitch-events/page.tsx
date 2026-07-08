import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { PitchEventsView } from "@/features/pitchEvents/components/PitchEventsView";

export default function PitchEventsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "cohort_manager", "investor", "founder"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Pitch events</h1>
        <PitchEventsView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
