"use client";

import { useState } from "react";
import { Building2, MapPin, Pencil, Tag, TrendingUp } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { StartupProfileForm } from "@/features/startups/components/StartupProfileForm";
import { TeamMembersPanel } from "@/features/startups/components/TeamMembersPanel";
import { OnboardingPanel } from "@/features/startups/components/OnboardingPanel";
import { KpiHistory } from "@/features/startups/components/KpiHistory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StartupWorkspace() {
  const { userDoc } = useAuth();
  const { startup, loading } = useMyStartup(userDoc?.uid);
  const [editing, setEditing] = useState(false);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading your startup profile...</div>;
  }

  if (!startup) {
    return <StartupProfileForm />;
  }

  if (editing) {
    return <StartupProfileForm existing={startup} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Building2 className="size-5" />
            </span>
            <div>
              <CardTitle>{startup.name}</CardTitle>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="gap-1">
                  <Tag className="size-3" /> {startup.sector}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <MapPin className="size-3" /> {startup.district}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="size-3" /> {startup.stage}
                </Badge>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit profile
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{startup.description}</p>
        </CardContent>
      </Card>

      {startup.incubation && <OnboardingPanel startup={startup} />}

      <TeamMembersPanel startup={startup} />

      {startup.incubation && <KpiHistory startupId={startup.id} />}
    </div>
  );
}
