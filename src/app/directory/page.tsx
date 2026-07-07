"use client";

import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { DirectoryManager } from "@/features/directory/components/DirectoryManager";
import { DirectoryBrowse } from "@/features/directory/components/DirectoryBrowse";

function DirectoryContent() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;
  return userDoc.role === "admin" || userDoc.role === "cohort_manager" ? (
    <DirectoryManager />
  ) : (
    <DirectoryBrowse />
  );
}

export default function DirectoryPage() {
  return (
    <ProtectedRoute>
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Ecosystem directory</h1>
        <DirectoryContent />
      </div>
    </ProtectedRoute>
  );
}
