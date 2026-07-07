"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useKpiSnapshots } from "@/features/startups/hooks/useKpiSnapshots";
import { setOnboardingItem } from "@/features/startups/lib/startupActions";
import { BaselineKpiForm } from "@/features/startups/components/BaselineKpiForm";
import { ONBOARDING_STEPS, type OnboardingChecklist, type StartupDoc } from "@/core/types";

export function OnboardingPanel({ startup }: { startup: StartupDoc }) {
  const { userDoc } = useAuth();
  const { snapshots } = useKpiSnapshots(startup.id);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [kpiOpen, setKpiOpen] = useState(false);

  const onboarding = startup.incubation?.onboarding;
  if (!startup.incubation || !onboarding) return null;

  // The baseline row is derived from an actual baseline snapshot existing —
  // not from the free-writable flag — so a crafted flag can't fake completion.
  const hasBaseline = snapshots.some((s) => s.isBaseline);
  const stepDone = (key: keyof OnboardingChecklist) =>
    key === "baselineKpiCaptured" ? hasBaseline : onboarding[key];

  const doneCount = ONBOARDING_STEPS.filter((s) => stepDone(s.key)).length;
  const allDone = doneCount === ONBOARDING_STEPS.length;

  async function toggleFounderItem(key: (typeof ONBOARDING_STEPS)[number]["key"], next: boolean) {
    if (!userDoc) return;
    setBusyKey(key);
    try {
      await setOnboardingItem(startup.id, { uid: userDoc.uid, role: userDoc.role }, key, next);
    } catch {
      toast.error("Could not update onboarding");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Onboarding</CardTitle>
            <CardDescription>
              Selected into {startup.incubation.cohortName}. Complete these steps to finish
              onboarding.
            </CardDescription>
          </div>
          <Badge
            variant="secondary"
            className={allDone ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"}
          >
            {doneCount}/{ONBOARDING_STEPS.length}
          </Badge>
        </div>
        <div className="mt-2 flex gap-1.5">
          {ONBOARDING_STEPS.map((step) => (
            <div
              key={step.key}
              className={`h-1.5 flex-1 rounded-full ${stepDone(step.key) ? "bg-success" : "bg-muted"}`}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {allDone && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-success/10 p-3 text-sm text-success">
            <PartyPopper className="size-4" />
            Onboarding complete — you&apos;re an active incubatee.
          </div>
        )}

        {ONBOARDING_STEPS.map((step) => {
          const done = stepDone(step.key);
          const isKpi = step.key === "baselineKpiCaptured";
          const isStaffOwned = step.owner === "staff";

          return (
            <div
              key={step.key}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
                {step.label}
              </span>

              {isStaffOwned ? (
                <Badge
                  variant="secondary"
                  className={done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}
                >
                  {done ? (
                    "Verified"
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" /> Pending cohort team
                    </span>
                  )}
                </Badge>
              ) : isKpi ? (
                done ? (
                  <Badge variant="secondary" className="bg-success/10 text-success">
                    Captured
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => setKpiOpen(true)}>
                    Capture
                  </Button>
                )
              ) : (
                <Button
                  size="sm"
                  variant={done ? "outline" : "default"}
                  disabled={busyKey === step.key}
                  onClick={() => toggleFounderItem(step.key, !done)}
                >
                  {done ? "Undo" : "Mark done"}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={kpiOpen} onOpenChange={setKpiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Capture baseline KPIs</DialogTitle>
          </DialogHeader>
          <BaselineKpiForm startupId={startup.id} onDone={() => setKpiOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
