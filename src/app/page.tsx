"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelinePreviewCard } from "@/components/PipelinePreviewCard";
import { useAuth } from "@/features/auth/hooks/useAuth";

const STEPS = [
  {
    icon: UserPlus,
    title: "Register",
    description: "Create an account and tell us your role — founder, evaluator, or cohort manager.",
  },
  {
    icon: ShieldCheck,
    title: "Get approved",
    description: "An admin reviews every registration before you get platform access.",
  },
  {
    icon: Building2,
    title: "Build your profile",
    description: "Founders set up a startup profile and delegate access to their team.",
  },
  {
    icon: FileCheck2,
    title: "Apply & get evaluated",
    description: "Apply to a cohort and move through a transparent, auditable review.",
  },
];

const ROLES = [
  {
    icon: Building2,
    title: "Founders",
    description: "One profile from application to graduation — team delegation included.",
  },
  {
    icon: ClipboardCheck,
    title: "Evaluators",
    description: "Score assigned applications with built-in conflict-of-interest checks.",
  },
  {
    icon: Users2,
    title: "Cohort managers",
    description: "Run the pipeline: eligibility, interviews, and locked committee decisions.",
  },
  {
    icon: UserCheck,
    title: "Admins",
    description: "Approve every account and hold the audit trail of record.",
  },
];

export default function Home() {
  const { firebaseUser, userDoc, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !firebaseUser || !userDoc) return;
    router.replace(userDoc.approvalStatus === "approved" ? "/dashboard" : "/pending-approval");
  }, [loading, firebaseUser, userDoc, router]);

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="bg-dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div className="space-y-6 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Image src="/logo.jpeg" alt="AIC Techno" width={142} height={32} className="h-4 w-auto" />
              Techno India Group
            </span>
            <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Run your startup ecosystem, end to end
            </h1>
            <p className="mx-auto max-w-lg text-lg text-muted-foreground text-balance lg:mx-0">
              Applications, evaluation, selection, and founder profiles — one governed platform
              for founders, evaluators, and cohort managers.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href="/register" className={buttonVariants({ size: "lg" })}>
                Get started
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Sign in
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 lg:items-end">
            <PipelinePreviewCard />
            <p className="text-xs text-muted-foreground">Illustrative preview</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            How it works
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold">{step.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento feature grid */}
      <section className="border-b border-border bg-card/50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Built like real institutional software
            </h2>
            <p className="mt-3 text-muted-foreground text-balance">
              Not a form builder with a coat of paint — role-based access, an audit trail, and a
              data model designed to grow with the ecosystem.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <Card className="md:col-span-2 md:row-span-1 border-border/60">
              <CardHeader>
                <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <ShieldCheck className="size-4.5" />
                </span>
                <CardTitle className="text-lg">Governed by design</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Every role&apos;s access is enforced server-side by Firestore security rules, not
                just hidden in the UI. Evaluators can&apos;t see each other&apos;s scores;
                applicants can&apos;t read reviewer notes. Every meaningful write is logged to an
                append-only audit trail from day one.
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Building2 className="size-4.5" />
                </span>
                <CardTitle className="text-lg">One startup profile</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Create your profile once and delegate access to co-founders, finance, sales, or
                operations team members.
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <ClipboardCheck className="size-4.5" />
                </span>
                <CardTitle className="text-lg">Transparent selection</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Evaluator scorecards, conflict-of-interest declarations, and committee decisions
                that lock once made.
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-border/60">
              <CardHeader>
                <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Users2 className="size-4.5" />
                </span>
                <CardTitle className="text-lg">Extensible without disruption</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Every feature lives in its own folder and only touches shared code through three
                fixed points — types, permissions, and the audit log — so new cohorts, services,
                and programs can be added without breaking what already works.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Built for every role
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role) => (
              <div
                key={role.title}
                className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <role.icon className="size-4.5" />
                </span>
                <h3 className="mt-3 font-semibold">{role.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary px-6 py-16 text-primary-foreground">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Ready to join the ecosystem?
          </h2>
          <p className="max-w-lg text-primary-foreground/80 text-balance">
            Register in a few minutes — an admin will review and approve your account.
          </p>
          <Link
            href="/register"
            className={buttonVariants({ size: "lg", variant: "secondary" })}
          >
            Register now
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="size-3.5" />
            </span>
            <span>Bengal Startup Ecosystem</span>
          </div>
          <span className="rounded-md bg-white p-2">
            <Image src="/logo.jpeg" alt="AIC Techno · NITI Aayog · Atal Innovation Mission" width={142} height={32} className="h-8 w-auto" />
          </span>
        </div>
      </footer>
    </div>
  );
}
