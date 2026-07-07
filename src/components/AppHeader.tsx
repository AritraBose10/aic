"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardList,
  FileStack,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Layers,
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
  { href: "/evaluate", label: "Evaluate", icon: ClipboardList, roles: ["evaluator"] },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck, roles: ["admin"] },
];

export function AppHeader() {
  const { userDoc } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
      <Link href="/dashboard" className="flex items-center gap-3">
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

      <nav className="flex items-center gap-1">
        {NAV_ITEMS.filter(
          (item) => !item.roles || (userDoc && item.roles.includes(userDoc.role)),
        ).map(
          (item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          },
        )}
      </nav>

      <div className="flex items-center gap-3 text-sm">
        {userDoc && (
          <span className="hidden text-muted-foreground sm:inline">{userDoc.name}</span>
        )}
        <Button size="sm" variant="outline" onClick={() => logoutUser()}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
