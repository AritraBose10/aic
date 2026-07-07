import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { HelpdeskForm } from "@/features/helpdesk/components/HelpdeskForm";
import { TicketsView } from "@/features/tickets/components/TicketsView";

export default function HelpdeskPage() {
  return (
    <ProtectedRoute>
      <AppHeader />
      <div className="mx-auto w-full max-w-3xl px-6 py-10 space-y-8">
        <div>
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">Helpdesk</h1>
          <HelpdeskForm />
        </div>
        <TicketsView kind="helpdesk" />
      </div>
    </ProtectedRoute>
  );
}
