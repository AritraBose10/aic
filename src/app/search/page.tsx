import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { SearchView } from "@/features/search/components/SearchView";

export default function SearchPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "cohort_manager", "founder", "investor", "probasi_adopter"]}>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">AI search</h1>
        <SearchView />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
