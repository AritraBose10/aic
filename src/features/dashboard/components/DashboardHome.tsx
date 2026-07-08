"use client";

import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck, Sparkles, Users2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ROLE_LABELS } from "@/core/roles/roleLabels";
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
  // Phase 4 self-service roles — verification-pending until an admin verifies
  // identity; feature access (discovery, data rooms, adoption) arrives with
  // those features. No CTA yet.
  investor: {
    message: "Your investor account is pending verification. Discovery unlocks once an admin verifies your profile.",
    icon: Building2,
  },
  probasi_adopter: {
    message: "Your Probasi adopter account is pending verification. Startup discovery unlocks after admin verification.",
    icon: Users2,
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
      <CardContent className="flex flex-col items-start gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="flex flex-wrap items-center gap-2">
          Signed in as {userDoc.email}
          <Badge variant="secondary">{ROLE_LABELS[userDoc.role]}</Badge>
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
