"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useDirectory } from "@/features/directory/hooks/useDirectory";
import { createDirectoryEntry, updateDirectoryEntry } from "@/features/directory/lib/directoryActions";
import { DIRECTORY_KIND_LABELS, type DirectoryKind } from "@/core/types";

const KINDS = Object.keys(DIRECTORY_KIND_LABELS) as DirectoryKind[];
const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function CreateEntryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { userDoc } = useAuth();
  const [kind, setKind] = useState<DirectoryKind>("mentor");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [languages, setLanguages] = useState("");
  const [contactUserId, setContactUserId] = useState("");
  const [expertise, setExpertise] = useState("");
  const [equipment, setEquipment] = useState("");
  const [services, setServices] = useState("");
  const [sla, setSla] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!userDoc || !name.trim()) return;
    setBusy(true);
    try {
      await createDirectoryEntry(
        { uid: userDoc.uid, role: userDoc.role },
        {
          kind, name, category, description, location,
          languages: csv(languages),
          contactUserId: contactUserId.trim() || undefined,
          expertise: kind === "mentor" ? csv(expertise) : [],
          equipment: kind === "fablab" ? csv(equipment).map((n) => ({ name: n })) : [],
          services: kind === "provider" ? csv(services) : [],
          sla: kind === "provider" ? sla : undefined,
        },
      );
      toast.success("Directory entry created");
      onOpenChange(false);
      setName(""); setCategory(""); setDescription(""); setLocation(""); setLanguages("");
      setContactUserId(""); setExpertise(""); setEquipment(""); setServices(""); setSla("");
    } catch {
      toast.error("Could not create entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New directory entry</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind((v ?? "mentor") as DirectoryKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => <SelectItem key={k} value={k}>{DIRECTORY_KIND_LABELS[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. GTM, IP, prototyping" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Languages (comma-sep)</Label>
              <Input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Bangla" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Linked user UID (optional — lets them host/fulfil)</Label>
            <Input value={contactUserId} onChange={(e) => setContactUserId(e.target.value)} />
          </div>
          {kind === "mentor" && (
            <div className="space-y-2">
              <Label>Expertise (comma-sep)</Label>
              <Input value={expertise} onChange={(e) => setExpertise(e.target.value)} />
            </div>
          )}
          {kind === "fablab" && (
            <div className="space-y-2">
              <Label>Equipment (comma-sep)</Label>
              <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="3D printer, Laser cutter" />
            </div>
          )}
          {kind === "provider" && (
            <>
              <div className="space-y-2">
                <Label>Services (comma-sep)</Label>
                <Input value={services} onChange={(e) => setServices(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>SLA</Label>
                <Input value={sla} onChange={(e) => setSla(e.target.value)} placeholder="e.g. 3 business days" />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !name.trim()}>Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DirectoryManager() {
  const { entries, loading } = useDirectory();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Ecosystem directory</CardTitle>
          <CardDescription>Mentors, fab labs, and service providers across all categories.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> New entry</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <p className="font-medium">{e.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{DIRECTORY_KIND_LABELS[e.kind]}</Badge>
                  {e.category && <Badge variant="outline">{e.category}</Badge>}
                  {!e.active && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => updateDirectoryEntry(e.id, { active: !e.active })}>
                {e.active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          ))
        )}
      </CardContent>
      <CreateEntryDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}
