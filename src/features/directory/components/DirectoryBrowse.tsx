"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPin, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { useDirectory } from "@/features/directory/hooks/useDirectory";
import { requestMeeting } from "@/core/meetings";
import { DIRECTORY_KIND_LABELS, type DirectoryEntryDoc, type DirectoryKind } from "@/core/types";

const ALL = "all";

function RequestSessionDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: DirectoryEntryDoc | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { userDoc } = useAuth();
  const { startup } = useMyStartup(userDoc?.uid);
  const [topic, setTopic] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!userDoc || !entry || !topic.trim() || !when) return;
    setBusy(true);
    try {
      await requestMeeting(
        { uid: userDoc.uid, role: userDoc.role, name: userDoc.name },
        {
          kind: "mentor",
          hostId: entry.contactUserId ?? "",
          hostName: entry.contactUserName ?? entry.name,
          topic,
          proposedAt: new Date(when),
          startupId: startup?.id,
        },
      );
      toast.success("Session requested");
      onOpenChange(false);
      setTopic(""); setWhen("");
    } catch {
      toast.error("Could not request session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Request a session with {entry?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Proposed time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !topic.trim() || !when}>Request</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DirectoryBrowse() {
  const { entries, loading } = useDirectory(undefined, true);
  const [kind, setKind] = useState<string>(ALL);
  const [text, setText] = useState("");
  const [requesting, setRequesting] = useState<DirectoryEntryDoc | null>(null);

  const filtered = useMemo(() => {
    const t = text.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (kind === ALL || e.kind === kind) &&
        (!t ||
          e.name.toLowerCase().includes(t) ||
          e.category.toLowerCase().includes(t) ||
          e.expertise.some((x) => x.toLowerCase().includes(t)) ||
          e.services.some((x) => x.toLowerCase().includes(t))),
    );
  }, [entries, kind, text]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, category, expertise…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <Select value={kind} onValueChange={(v) => setKind(v ?? ALL)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All kinds</SelectItem>
            {(Object.keys(DIRECTORY_KIND_LABELS) as DirectoryKind[]).map((k) => (
              <SelectItem key={k} value={k}>{DIRECTORY_KIND_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <Users className="size-7" />
          <p className="text-sm">No matching directory entries.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((e) => (
            <Card key={e.id}>
              <CardHeader>
                <CardTitle className="text-base">{e.name}</CardTitle>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary">{DIRECTORY_KIND_LABELS[e.kind]}</Badge>
                  {e.category && <Badge variant="outline">{e.category}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{e.description}</p>
                {e.location && (
                  <p className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {e.location}</p>
                )}
                {e.expertise.length > 0 && <p>Expertise: {e.expertise.join(", ")}</p>}
                {e.services.length > 0 && <p>Services: {e.services.join(", ")}</p>}
                {e.kind === "mentor" && (
                  <Button size="sm" onClick={() => setRequesting(e)}>Request session</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RequestSessionDialog entry={requesting} open={!!requesting} onOpenChange={(o) => !o && setRequesting(null)} />
    </div>
  );
}
