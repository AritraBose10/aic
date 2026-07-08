"use client";

import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Full-width top header: logo, user info, sign-out */}
      <AppHeader />

      {/* Below the header: sidebar + scrollable content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: nav links only (desktop) */}
        <AppSidebar />

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
