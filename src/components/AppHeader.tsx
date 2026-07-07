"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Building2,
  ClipboardList,
  Compass,
  Cpu,
  FileStack,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Layers,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { logoutUser } from "@/features/auth/lib/authActions";
import type { Role } from "@/core/types";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[] | null;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/startup", label: "My Startup", icon: Building2, roles: ["founder"] },
  { href: "/cohorts", label: "Cohorts", icon: Layers, roles: ["admin", "cohort_manager", "founder"] },
  { href: "/applications", label: "Applications", icon: FileStack, roles: ["founder"] },
  { href: "/training", label: "Training", icon: GraduationCap, roles: ["admin", "cohort_manager", "founder"] },
  { href: "/graduation", label: "Graduation", icon: Award, roles: ["admin", "cohort_manager"] },
  { href: "/directory", label: "Directory", icon: Compass, roles: null },
  { href: "/mentors", label: "Mentors", icon: Users, roles: ["admin", "cohort_manager", "founder"] },
  { href: "/fablabs", label: "Fab labs", icon: Cpu, roles: ["admin", "cohort_manager", "founder"] },
  { href: "/services", label: "Services", icon: Wrench, roles: ["admin", "cohort_manager", "founder"] },
  { href: "/helpdesk", label: "Helpdesk", icon: LifeBuoy, roles: null },
  { href: "/evaluate", label: "Evaluate", icon: ClipboardList, roles: ["evaluator"] },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck, roles: ["admin"] },
  { href: "/admin/masters", label: "Masters", icon: Settings, roles: ["admin"] },
];

export function AppHeader() {
  const { userDoc } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isDashboard = pathname === "/dashboard";

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (userDoc && item.roles.includes(userDoc.role)),
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
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
            <span className="hidden font-semibold tracking-tight lg:inline">
              Bengal Startup Ecosystem
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

        <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex [scrollbar-width:thin]">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 text-sm md:flex">
          {userDoc && (
            <span className="hidden text-muted-foreground lg:inline">{userDoc.name}</span>
          )}
          <Button size="sm" variant="outline" onClick={() => logoutUser()}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
      </div>

      {open && (
        <div className="max-h-[70vh] overflow-y-auto border-t border-border px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            {userDoc && <span className="text-sm text-muted-foreground">{userDoc.name}</span>}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOpen(false);
                logoutUser();
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
