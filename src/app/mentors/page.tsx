import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { MeetingsView } from "@/features/meetings/components/MeetingsView";

export default function MentorsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Mentor sessions</h1>
        <MeetingsView kind="mentor" emptyLabel="No mentor sessions yet — request one from the directory." />
      </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
