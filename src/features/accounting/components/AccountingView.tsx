"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useMyStartup } from "@/features/startups/hooks/useMyStartup";
import { can } from "@/core/roles/permissions";
import { useFinanceEntries } from "@/features/accounting/hooks/useFinance";
import { recordFinanceEntry } from "@/features/accounting/lib/financeActions";
import type { FinanceEntryKind } from "@/core/types";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function AccountingView() {
  const { userDoc } = useAuth();
  const { startup, loading } = useMyStartup(userDoc?.uid);
  const { entries } = useFinanceEntries(startup?.id);
  const [kind, setKind] = useState<FinanceEntryKind>("invoice");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!userDoc || !startup) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Create your startup profile first to use accounting.
      </CardContent></Card>
    );
  }
  if (!can(userDoc.role, "finance:manage_own")) {
    return <p className="text-sm text-muted-foreground">Accounting is available to founders.</p>;
  }

  const owner = { startupId: startup.id, startupName: startup.name, founderId: startup.founderId };
  const actor = { uid: userDoc.uid, role: userDoc.role };

  const invoiced = entries.filter((e) => e.kind === "invoice").reduce((s, e) => s + e.amount, 0);
  const expensed = entries.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0);
  const cash = entries.filter((e) => e.kind === "invoice" && e.paid).reduce((s, e) => s + e.amount, 0) - expensed;

  async function add() {
    if (!description.trim() || !amount) return;
    setBusy(true);
    try {
      await recordFinanceEntry(actor, owner, {
        kind, description, amount: Number(amount),
        paid: kind === "invoice" ? false : undefined,
        occurredAt: new Date(),
      });
      setDescription(""); setAmount("");
      toast.success("Recorded");
    } catch {
      toast.error("Could not record");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-sm text-muted-foreground">Invoiced</p><p className="mt-1 text-2xl font-semibold tabular-nums">{inr(invoiced)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-sm text-muted-foreground">Expenses</p><p className="mt-1 text-2xl font-semibold tabular-nums">{inr(expensed)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-sm text-muted-foreground">Cash position</p><p className="mt-1 text-2xl font-semibold tabular-nums">{inr(cash)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record invoice / expense</CardTitle>
          <CardDescription>Lightweight bookkeeping — feeds the ops summary staff see.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind((v ?? "invoice") as FinanceEntryKind)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-40 space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" min={0} className="w-32" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <Button onClick={add} disabled={busy || !description.trim() || !amount}><Plus className="size-4" /> Record</Button>
          </div>

          <ul className="divide-y divide-border rounded-md border border-border">
            {entries.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nothing recorded yet.</li>}
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className={e.kind === "invoice" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                    {e.kind}
                  </Badge>
                  {e.description}
                </span>
                <span className="tabular-nums">{inr(e.amount)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
