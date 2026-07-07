"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMasters } from "@/core/masters/useMasters";
import { createMasterEntry, updateMasterEntry, MASTER_TYPE_LABELS } from "@/core/masters";
import type { MasterType } from "@/core/types";

const TYPES = Object.keys(MASTER_TYPE_LABELS) as MasterType[];

function TypePanel({ type }: { type: MasterType }) {
  const { userDoc } = useAuth();
  const { entries, loading } = useMasters(type, true);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!userDoc || !newLabel.trim()) return;
    setBusy(true);
    try {
      await createMasterEntry({ uid: userDoc.uid, role: userDoc.role }, type, newLabel, entries.length);
      setNewLabel("");
    } catch {
      toast.error("Could not add entry");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    if (!userDoc) return;
    try {
      await updateMasterEntry({ uid: userDoc.uid, role: userDoc.role }, id, { active: !active });
    } catch {
      toast.error("Could not update entry");
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={`Add a ${MASTER_TYPE_LABELS[type].toLowerCase().replace(/s$/, "")}…`}
        />
        <Button type="submit" disabled={busy || !newLabel.trim()}>
          <Plus className="size-4" />
          Add
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                {entry.label}
                {!entry.active && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Inactive
                  </Badge>
                )}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggle(entry.id, entry.active)}
              >
                {entry.active ? <X className="size-4" /> : <Check className="size-4" />}
                {entry.active ? "Deactivate" : "Activate"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MastersManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Master data</CardTitle>
        <CardDescription>
          Configure the taxonomies used across the platform. Deactivated entries stay on existing
          records but disappear from new pickers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={TYPES[0]}>
          <TabsList className="flex-wrap">
            {TYPES.map((t) => (
              <TabsTrigger key={t} value={t}>
                {MASTER_TYPE_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>
          {TYPES.map((t) => (
            <TabsContent key={t} value={t} className="pt-4">
              <TypePanel type={t} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
