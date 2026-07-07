import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface HeroFlowCardProps {
  steps: { icon: LucideIcon; title: string; description: string }[];
}

export function HeroFlowCard({ steps }: HeroFlowCardProps) {
  return (
    <div className="relative w-full max-w-sm">
      <div className="absolute -top-4 -right-4 z-10 hidden -rotate-3 items-center gap-2 rounded-xl border border-border/60 bg-accent px-3 py-2 shadow-lg shadow-slate-900/10 sm:flex">
        <ShieldCheck className="size-4 text-accent-foreground" />
        <div className="leading-tight">
          <p className="text-xs font-semibold text-accent-foreground">Governed access</p>
          <p className="text-[11px] text-accent-foreground/70">Enforced server-side</p>
        </div>
      </div>

      <Card className="relative w-full border-border/60 shadow-xl shadow-slate-900/5">
        <CardHeader className="border-b border-border/60 pb-4">
          <p className="text-sm font-semibold leading-none">Your path to launch</p>
          <p className="mt-1 text-xs text-muted-foreground">Four steps, fully auditable</p>
        </CardHeader>
        <CardContent className="space-y-0 pt-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === steps.length - 1;
            return (
              <div key={step.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  {!isLast && <span className="my-1 w-px flex-1 bg-border" />}
                </div>
                <div className={isLast ? "pb-0" : "pb-4"}>
                  <p className="text-sm font-medium leading-none">{step.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
