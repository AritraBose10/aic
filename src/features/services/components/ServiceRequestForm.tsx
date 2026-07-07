"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { useMasters } from "@/core/masters/useMasters";
import { createTicket } from "@/core/tickets";
import type { TicketUrgency } from "@/core/types";

export function ServiceRequestForm() {
  const { userDoc } = useAuth();
  const { startup } = useMyStartup(userDoc?.uid);
  const { entries: categories } = useMasters("serviceCategory");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState<TicketUrgency>("medium");
  const [requiredOutcome, setRequiredOutcome] = useState("");
  const [slaDays, setSlaDays] = useState("7");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!userDoc || !title.trim() || !category) return;
    setBusy(true);
    try {
      await createTicket(
        { uid: userDoc.uid, role: userDoc.role, name: userDoc.name },
        { kind: "service", title, category, urgency, requiredOutcome, startupId: startup?.id, slaDays: Number(slaDays) || undefined },
      );
      toast.success("Service request raised");
      setTitle(""); setCategory(""); setRequiredOutcome(""); setUrgency("medium"); setSlaDays("7");
    } catch {
      toast.error("Could not raise request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request ecosystem support</CardTitle>
        <CardDescription>Mentoring, marketing, accounting, IP, logistics and more.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">No categories yet — an admin adds them in Masters.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Urgency</Label>
            <Select value={urgency} onValueChange={(v) => setUrgency((v ?? "medium") as TicketUrgency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Required outcome</Label>
          <Textarea rows={2} value={requiredOutcome} onChange={(e) => setRequiredOutcome(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Target SLA (days)</Label>
          <Input type="number" min={1} className="w-28" value={slaDays} onChange={(e) => setSlaDays(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy || !title.trim() || !category}>
            <Plus className="size-4" /> Raise request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
