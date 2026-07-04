"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useEvaluators } from "@/features/applications/hooks/useEvaluators";
import { assignEvaluators } from "@/features/applications/lib/applicationActions";
import type { ApplicationDoc } from "@/core/types";

export function EvaluatorAssignmentPanel({ application }: { application: ApplicationDoc }) {
  const { userDoc } = useAuth();
  const { evaluators, loading } = useEvaluators();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(application.evaluatorIds);
  const [saving, setSaving] = useState(false);

  function toggle(uid: string) {
    setSelected((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  }

  async function handleSave() {
    if (!userDoc) return;
    setSaving(true);
    try {
      await assignEvaluators(application.id, { uid: userDoc.uid, role: userDoc.role }, selected);
      toast.success("Evaluators updated");
      setOpen(false);
    } catch {
      toast.error("Could not update evaluators");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setSelected(application.evaluatorIds);
          setOpen(true);
        }}
      >
        <Users className="size-4" />
        {application.evaluatorIds.length > 0
          ? `${application.evaluatorIds.length} assigned`
          : "Assign evaluators"}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign evaluators</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading evaluators...</p>
        ) : evaluators.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approved evaluators yet — approve an evaluator account first.
          </p>
        ) : (
          <div className="space-y-3">
            {evaluators.map((evaluator) => (
              <div key={evaluator.uid} className="flex items-center gap-2">
                <Checkbox
                  id={`eval-${evaluator.uid}`}
                  checked={selected.includes(evaluator.uid)}
                  onCheckedChange={() => toggle(evaluator.uid)}
                />
                <Label htmlFor={`eval-${evaluator.uid}`} className="font-normal">
                  {evaluator.name} <span className="text-muted-foreground">({evaluator.email})</span>
                </Label>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
