"use client";

import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* NFR-06: keyboard skip-to-content — visually hidden until focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Full-width top header: logo, user info, sign-out */}
      <AppHeader />

      {/* Below the header: sidebar + scrollable content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: nav links only (desktop) */}
        <AppSidebar />

        {/* Main scrollable area */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
