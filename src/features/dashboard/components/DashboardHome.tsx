"use client";

import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Sparkles, Users2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { Role } from "@/core/types";

const ROLE_CONTENT: Record<
  Role,
  { message: string; icon: typeof Building2; cta?: { href: string; label: string } }
> = {
  admin: {
    message: "Review pending accounts and manage cohorts for the current pipeline.",
    icon: ShieldCheck,
    cta: { href: "/admin/approvals", label: "Review pending approvals" },
  },
  cohort_manager: {
    message: "Create cohorts, assign evaluators, and record committee decisions.",
    icon: Users2,
    cta: { href: "/cohorts", label: "Manage cohorts" },
  },
  evaluator: {
    message: "Score your assigned applications and declare any conflicts of interest.",
    icon: Sparkles,
    cta: { href: "/evaluate", label: "View assigned applications" },
  },
  founder: {
    message: "Manage your startup profile, delegate team access, and apply to open cohorts.",
    icon: Building2,
    cta: { href: "/cohorts", label: "Browse open cohorts" },
  },
};

export function DashboardHome() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;

  const content = ROLE_CONTENT[userDoc.role];
  const Icon = content.icon;

  return (
    <Card>
      <CardHeader>
        <span className="mb-1 flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-4.5" />
        </span>
        <CardTitle>Welcome, {userDoc.name}</CardTitle>
        <CardDescription>{content.message}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Signed in as {userDoc.email} — role: {userDoc.role.replace("_", " ")}
        </span>
        {content.cta && (
          <Link href={content.cta.href} className={buttonVariants({ size: "sm" })}>
            {content.cta.label}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
