"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { createTicket } from "@/core/tickets";
import type { TicketUrgency } from "@/core/types";

const CATEGORIES = ["Account & access", "Technical issue", "Data / records", "How-to", "Other"];

export function HelpdeskForm() {
  const { userDoc } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [urgency, setUrgency] = useState<TicketUrgency>("medium");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!userDoc || !title.trim()) return;
    setBusy(true);
    try {
      await createTicket(
        { uid: userDoc.uid, role: userDoc.role, name: userDoc.name },
        { kind: "helpdesk", title, category, urgency, requiredOutcome: detail },
      );
      toast.success("Support ticket raised");
      setTitle(""); setDetail(""); setUrgency("medium");
    } catch {
      toast.error("Could not raise ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact the helpdesk</CardTitle>
        <CardDescription>Raise a support request — we&apos;ll track it to resolution.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Subject</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? CATEGORIES[0])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
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
          <Label>Details</Label>
          <Textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy || !title.trim()}>
            <LifeBuoy className="size-4" /> Submit ticket
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
