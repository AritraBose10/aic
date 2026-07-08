"use client";

import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { FabLabBrowse } from "@/features/fablabs/components/FabLabBrowse";
import { MeetingsView } from "@/features/meetings/components/MeetingsView";

function FabLabContent() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;
  const isStaff = userDoc.role === "admin" || userDoc.role === "cohort_manager";

  return (
    <div className="space-y-8">
      {userDoc.role === "founder" && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Book a fab lab</h2>
          <FabLabBrowse />
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {isStaff ? "Manage bookings" : "My bookings"}
        </h2>
        <MeetingsView kind="fablab" emptyLabel="No fab lab bookings yet." />
      </section>
    </div>
  );
}

export default function FabLabsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Fab labs</h1>
        <FabLabContent />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
