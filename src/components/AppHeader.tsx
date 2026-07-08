"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { logoutUser } from "@/features/auth/lib/authActions";
import { ROLE_LABELS } from "@/core/roles/roleLabels";
import { MobileNavTrigger } from "@/components/AppSidebar";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppHeader() {
  const { userDoc } = useAuth();
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6 relative">
      {/* Left: mobile hamburger + logo */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger — only visible on mobile (md:hidden is inside MobileNavTrigger) */}
        <MobileNavTrigger />

        <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
          <span className="rounded-md bg-white p-1.5">
            <Image
              src="/logo.jpeg"
              alt="AIC Techno"
              width={142}
              height={32}
              className="w-auto"
              style={{ height: 28 }}
            />
          </span>
        </Link>

        {!isDashboard && (
          <>
            <span className="hidden h-6 w-px bg-border sm:inline" />
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </>
        )}
      </div>

      {/* Centre: page title — absolutely positioned so it's always centred */}
      <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/50 px-3.5 py-1 text-sm font-medium backdrop-blur-sm dark:border-sky-900/50 dark:bg-sky-950/30">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex size-2 rounded-full bg-sky-500"></span>
          </span>
          <span className="bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-600 bg-clip-text font-semibold tracking-tight text-transparent dark:from-sky-400 dark:to-indigo-400">
            Bengal Startup Ecosystem
          </span>
        </div>
      </div>

      {/* Right: user info + sign out */}
      <div className="flex shrink-0 items-center gap-3 text-sm">
        {userDoc && (
          <div className="hidden items-center gap-2 lg:flex">
            <Avatar size="sm">
              <AvatarFallback>{getInitials(userDoc.name)}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">{userDoc.name}</span>
            <Badge variant="secondary">{ROLE_LABELS[userDoc.role]}</Badge>
          </div>
        )}
        <Button size="sm" variant="outline" onClick={() => logoutUser()}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
