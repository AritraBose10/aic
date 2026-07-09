"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Handshake, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useAdoptionWorkspaces } from "@/features/adoptionWorkspace/hooks/useWorkspaces";
import { updateWorkspace, contributeAdoptionLead } from "@/features/adoptionWorkspace/lib/workspaceActions";
import { ADOPTION_MODE_LABELS, type AdoptionImpact, type AdoptionWorkspaceDoc, type Role } from "@/core/types";

const IMPACT_FIELDS: [keyof AdoptionImpact, string][] = [
  ["mentorHours", "Mentor hours"],
  ["salesLeads", "Sales leads"],
  ["meetings", "Meetings"],
  ["fundsCommittedLakh", "Funds committed (₹ lakh)"],
  ["introductions", "Introductions"],
  ["docsReviewed", "Docs reviewed"],
];

function WorkspaceCard({ ws, actor, isAdopter }: { ws: AdoptionWorkspaceDoc; actor: { uid: string; role: Role; name: string }; isAdopter: boolean }) {
  const [goals, setGoals] = useState(ws.goals);
  const [commitments, setCommitments] = useState(ws.commitments);
  const [impact, setImpact] = useState<AdoptionImpact>(ws.impact);
  const [leadName, setLeadName] = useState("");
  const [addingLead, setAddingLead] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div><CardTitle className="text-base">{ws.startupName}</CardTitle>
          <CardDescription>with {ws.adopterName} · {ws.modes.map((m) => ADOPTION_MODE_LABELS[m]).join(", ")}</CardDescription></div>
        <Badge variant="secondary">workspace</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1"><Label className="text-xs">Goals</Label><Textarea rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Commitments</Label><Textarea rows={2} value={commitments} onChange={(e) => setCommitments(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {IMPACT_FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1">
              <Label className="text-[11px]">{label}</Label>
              <Input type="number" min={0} value={impact[k]} onChange={(e) => setImpact((p) => ({ ...p, [k]: Number(e.target.value) || 0 }))} />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => updateWorkspace(actor, ws, { goals, commitments, impact }).then(() => toast.success("Saved")).catch(() => toast.error("Failed"))}>Save workspace</Button>
        </div>

        {isAdopter && (
          <div className="space-y-2 rounded-md border border-border p-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contribute a sales lead (ABS-06)</p>
            <div className="flex items-end gap-2">
              <Input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Lead name / company" />
              <Button size="sm" variant="outline" disabled={!leadName.trim() || addingLead}
                onClick={() => {
                  setAddingLead(true);
                  contributeAdoptionLead(actor, { startupId: ws.startupId, founderId: ws.founderId }, { name: leadName })
                    .then(() => { toast.success("Lead added to startup CRM"); setLeadName(""); })
                    .catch(() => toast.error("Failed"))
                    .finally(() => setAddingLead(false));
                }}>
                <Plus className="size-4" /> Add lead
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdoptionWorkspaceView() {
  const { userDoc } = useAuth();
  const isAdopter = userDoc?.role === "probasi_adopter";
  const workspaces = useAdoptionWorkspaces(
    isAdopter ? { adopterUid: userDoc?.uid } : { founderId: userDoc?.uid },
  );
  if (!userDoc) return null;
  const actor = { uid: userDoc.uid, role: userDoc.role, name: userDoc.name };

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Handshake className="size-4" /> Adoption workspaces
      </h2>
      {workspaces.length === 0 ? <p className="text-sm text-muted-foreground">No active workspaces yet.</p>
        : workspaces.map((ws) => <WorkspaceCard key={ws.id} ws={ws} actor={actor} isAdopter={!!isAdopter} />)}
    </div>
  );
}
