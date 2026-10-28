"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { captureBaselineKpi } from "@/features/startups/lib/startupActions";

const REVENUE_BANDS = [
  "Pre-revenue",
  "Under ₹1 lakh",
  "₹1–10 lakh",
  "₹10–50 lakh",
  "₹50 lakh – 1 crore",
  "Over ₹1 crore",
];

const schema = z.object({
  revenueBand: z.string().min(1, "Select a revenue band"),
  customers: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, "Enter a whole number"),
  teamSize: z.string().refine((v) => Number.isInteger(Number(v)) && Number(v) >= 0, "Enter a whole number"),
  fundsRaised: z.string().refine((v) => Number(v) >= 0, "Enter an amount (0 if none)"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function BaselineKpiForm({ startupId, onDone }: { startupId: string; onDone: () => void }) {
  const { userDoc } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { revenueBand: "", customers: "0", teamSize: "1", fundsRaised: "0", notes: "" },
  });
  const revenueBand = useWatch({ control: form.control, name: "revenueBand" });

  async function onSubmit(data: FormValues) {
    if (!userDoc) return;
    setSubmitting(true);
    try {
      await captureBaselineKpi(
        startupId,
        { uid: userDoc.uid, role: userDoc.role },
        {
          revenueBand: data.revenueBand,
          customers: Number(data.customers),
          teamSize: Number(data.teamSize),
          fundsRaised: Number(data.fundsRaised),
          notes: data.notes,
        },
      );
      toast.success("Baseline KPIs captured");
      onDone();
    } catch {
      toast.error("Could not capture baseline KPIs");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        This is your <span className="font-medium text-foreground">baseline</span> — captured once
        and never overwritten. Later progress is recorded as new periodic snapshots.
      </p>

      <div className="space-y-2">
        <Label>Revenue band</Label>
        <Select
          value={revenueBand}
          onValueChange={(v) => form.setValue("revenueBand", v ?? "", { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a band" />
          </SelectTrigger>
          <SelectContent>
            {REVENUE_BANDS.map((band) => (
              <SelectItem key={band} value={band}>
                {band}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.revenueBand && (
          <p className="text-sm text-destructive">{form.formState.errors.revenueBand.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="customers">Customers</Label>
          <Input id="customers" type="number" min={0} {...form.register("customers")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teamSize">Team size</Label>
          <Input id="teamSize" type="number" min={0} {...form.register("teamSize")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fundsRaised">Funds raised (₹)</Label>
          <Input id="fundsRaised" type="number" min={0} {...form.register("fundsRaised")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" rows={2} {...form.register("notes")} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Capture baseline"}
        </Button>
      </div>
    </form>
  );
}
