"use client";

import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ServiceRequestForm } from "@/features/services/components/ServiceRequestForm";
import { TicketsView } from "@/features/tickets/components/TicketsView";

function ServicesContent() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;
  return (
    <div className="space-y-8">
      {userDoc.role === "founder" && <ServiceRequestForm />}
      <TicketsView kind="service" />
    </div>
  );
}

export default function ServicesPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Service requests</h1>
        <ServicesContent />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
