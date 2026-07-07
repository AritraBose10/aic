"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Cpu, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { useDirectory } from "@/features/directory/hooks/useDirectory";
import { requestMeeting } from "@/core/meetings";
import type { DirectoryEntryDoc } from "@/core/types";

function BookDialog({ lab, open, onOpenChange }: { lab: DirectoryEntryDoc | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { userDoc } = useAuth();
  const { startup } = useMyStartup(userDoc?.uid);
  const [equipment, setEquipment] = useState("");
  const [when, setWhen] = useState("");
  const [safetyAck, setSafetyAck] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = lab?.equipment.find((e) => e.name === equipment);

  async function submit() {
    if (!userDoc || !lab || !equipment || !when || !safetyAck) return;
    setBusy(true);
    try {
      await requestMeeting(
        { uid: userDoc.uid, role: userDoc.role, name: userDoc.name },
        {
          kind: "fablab",
          hostId: lab.contactUserId ?? "",
          hostName: lab.contactUserName ?? lab.name,
          topic: `${lab.name} — ${equipment}`,
          proposedAt: new Date(when),
          startupId: startup?.id,
          resourceName: equipment,
        },
      );
      toast.success("Booking requested");
      onOpenChange(false);
      setEquipment(""); setWhen(""); setSafetyAck(false);
    } catch {
      toast.error("Could not request booking");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Book equipment — {lab?.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Equipment</Label>
            <RadioGroup value={equipment} onValueChange={(v) => { setEquipment(v ?? ""); setSafetyAck(false); }}>
              {lab?.equipment.map((e) => (
                <div key={e.name} className="flex items-center gap-2">
                  <RadioGroupItem value={e.name} id={`eq-${e.name}`} />
                  <Label htmlFor={`eq-${e.name}`} className="font-normal">{e.name}</Label>
                </div>
              ))}
              {lab?.equipment.length === 0 && <p className="text-sm text-muted-foreground">No equipment listed.</p>}
            </RadioGroup>
          </div>

          {equipment && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <ShieldAlert className="size-4 text-amber-600" /> Safety prerequisites
              </p>
              <p className="mt-1 text-muted-foreground">
                {selected?.safetyPrereq || "Follow all lab safety rules and complete the required induction before use."}
              </p>
              <label className="mt-2 flex items-center gap-2">
                <Checkbox checked={safetyAck} onCheckedChange={() => setSafetyAck((v) => !v)} />
                <span>I acknowledge and will comply with these safety requirements.</span>
              </label>
            </div>
          )}

          <div className="space-y-2">
            <Label>Proposed time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !equipment || !when || !safetyAck}>
              Request booking
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FabLabBrowse() {
  const { entries, loading } = useDirectory("fablab", true);
  const [booking, setBooking] = useState<DirectoryEntryDoc | null>(null);

  if (loading) return <p className="text-sm text-muted-foreground">Loading fab labs…</p>;
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No fab labs listed yet.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map((lab) => (
        <Card key={lab.id}>
          <CardHeader>
            <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Cpu className="size-4" />
            </span>
            <CardTitle className="text-base">{lab.name}</CardTitle>
            <CardDescription>{lab.location}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {lab.equipment.map((e) => <Badge key={e.name} variant="secondary">{e.name}</Badge>)}
            </div>
            <Button size="sm" onClick={() => setBooking(lab)}>Book equipment</Button>
          </CardContent>
        </Card>
      ))}
      <BookDialog lab={booking} open={!!booking} onOpenChange={(o) => !o && setBooking(null)} />
    </div>
  );
}
