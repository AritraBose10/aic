"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { setOnboardingItem } from "@/features/startups/lib/startupActions";
import type { StartupDoc } from "@/core/types";

/**
 * Staff control for the one staff-owned onboarding item (founder verification).
 * Self-subscribes to the startup so the committee view doesn't need to load it.
 */
export function FounderVerificationControl({ startupId }: { startupId: string }) {
  const { userDoc } = useAuth();
  const [startup, setStartup] = useState<StartupDoc | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "startups", startupId), (snap) => {
      setStartup(snap.exists() ? ({ id: snap.id, ...snap.data() } as StartupDoc) : null);
    });
    return unsubscribe;
  }, [startupId]);

  const onboarding = startup?.incubation?.onboarding;
  if (!onboarding) return null;

  const verified = onboarding.founderVerified;

  async function toggle() {
    if (!userDoc) return;
    setBusy(true);
    try {
      await setOnboardingItem(startupId, { uid: userDoc.uid, role: userDoc.role }, "founderVerified", !verified);
      toast.success(verified ? "Verification cleared" : "Founder verified");
    } catch {
      toast.error("Could not update verification");
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return (
      <Badge variant="secondary" className="bg-success/10 text-success">
        <BadgeCheck className="size-3" /> Founder verified
      </Badge>
    );
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={toggle}>
      <BadgeCheck className="size-4" />
      Verify founder
    </Button>
  );
}
