"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  Contact,
  Cpu,
  FileStack,
  GitMerge,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  Landmark,
  Menu,
  Presentation,
  Receipt,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Layers,
  TrendingUp,
  UserCog,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Role } from "@/core/types";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[] | null;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
  { href: "/search", label: "AI search", icon: Search, roles: ["admin", "cohort_manager", "founder", "investor", "probasi_adopter"] },
  { href: "/startup", label: "My Startup", icon: Building2, roles: ["founder"] },
  { href: "/cohorts", label: "Cohorts", icon: Layers, roles: ["admin", "cohort_manager", "founder"] },
  { href: "/applications", label: "Applications", icon: FileStack, roles: ["founder"] },
  { href: "/crm", label: "CRM", icon: Contact, roles: ["founder"] },
  { href: "/accounting", label: "Accounting", icon: Receipt, roles: ["founder"] },
  { href: "/outreach", label: "Outreach", icon: Sparkles, roles: ["founder"] },
  { href: "/ip", label: "IP support", icon: Scale, roles: ["admin", "cohort_manager", "founder"] },
  { href: "/investor-profile", label: "Investor profile", icon: Presentation, roles: ["founder"] },
  { href: "/investor", label: "Investor connect", icon: Landmark, roles: ["investor", "admin", "cohort_manager"] },
  { href: "/pitch-events", label: "Pitch events", icon: CalendarDays, roles: ["admin", "cohort_manager", "investor", "founder"] },
  { href: "/deals", label: "Deals", icon: TrendingUp, roles: ["admin", "cohort_manager", "investor", "founder"] },
  { href: "/adoption", label: "Adoption", icon: Handshake, roles: ["probasi_adopter", "founder", "admin", "cohort_manager"] },
  { href: "/adoption-workspace", label: "Adoption workspace", icon: BarChart3, roles: ["probasi_adopter", "founder", "admin", "cohort_manager"] },
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
  { href: "/admin/duplicates", label: "Duplicates", icon: GitMerge, roles: ["admin", "cohort_manager"] },
  { href: "/account", label: "Account", icon: UserCog, roles: null },
];

// ─── Desktop sidebar (nav links only) ────────────────────────────────────────

export function AppSidebar() {
  const { userDoc } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (userDoc && item.roles.includes(userDoc.role)),
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 border-r border-border bg-background transition-[width] duration-200 ease-in-out overflow-hidden",
        collapsed ? "w-[56px]" : "w-[220px]",
      )}
    >
      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 [scrollbar-width:none]">
        <ul className="flex flex-col gap-0.5 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sky-50 text-sky-900"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex shrink-0 w-full items-center justify-center border-t border-border py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>
    </aside>
  );
}

// ─── Mobile nav drawer ────────────────────────────────────────────────────────

export function MobileNavDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { userDoc } = useAuth();
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (userDoc && item.roles.includes(userDoc.role)),
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer — slides in from left, sits below the header */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-border bg-background md:hidden">
        {/* Drawer header: just a title + close button */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-sm font-semibold text-foreground">Navigation</span>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 [scrollbar-width:none]">
          <ul className="flex flex-col gap-0.5 px-2">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sky-50 text-sky-900"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

// ─── Mobile nav trigger (hamburger button for the header) ─────────────────────

export function MobileNavTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      <MobileNavDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
