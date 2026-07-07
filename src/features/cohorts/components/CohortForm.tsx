"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCohort, updateCohort } from "@/features/cohorts/lib/cohortActions";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { CohortDoc } from "@/core/types";

const schema = z
  .object({
    name: z.string().min(2, "Cohort name is required"),
    sectorFocus: z.string().min(1, "List at least one sector"),
    eligibilityRules: z.string().min(5, "Describe the eligibility rules"),
    scoringRubric: z.string().min(5, "Describe the scoring rubric"),
    capacity: z
      .string()
      .min(1, "Capacity is required")
      .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, "Capacity must be a positive number"),
    applicationOpenAt: z.string().min(1, "Open date is required"),
    applicationCloseAt: z.string().min(1, "Close date is required"),
  })
  .refine((data) => new Date(data.applicationCloseAt) > new Date(data.applicationOpenAt), {
    message: "Close date must be after the open date",
    path: ["applicationCloseAt"],
  });

type FormValues = z.infer<typeof schema>;

function toDateInputValue(timestamp?: { toDate: () => Date }): string {
  if (!timestamp) return "";
  return timestamp.toDate().toISOString().slice(0, 10);
}

interface CohortFormProps {
  existing?: CohortDoc | null;
  onDone: () => void;
}

export function CohortForm({ existing, onDone }: CohortFormProps) {
  const { userDoc } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      sectorFocus: existing?.sectorFocus.join(", ") ?? "",
      eligibilityRules: existing?.eligibilityRules ?? "",
      scoringRubric: existing?.scoringRubric ?? "",
      capacity: String(existing?.capacity ?? 20),
      applicationOpenAt: toDateInputValue(existing?.applicationOpenAt),
      applicationCloseAt: toDateInputValue(existing?.applicationCloseAt),
    },
  });

  async function onSubmit(data: FormValues) {
    if (!userDoc) return;
    setSubmitting(true);
    try {
      const actor = { uid: userDoc.uid, role: userDoc.role };
      const input = {
        name: data.name,
        sectorFocus: data.sectorFocus.split(",").map((s) => s.trim()).filter(Boolean),
        eligibilityRules: data.eligibilityRules,
        scoringRubric: data.scoringRubric,
        capacity: Number(data.capacity),
        applicationOpenAt: new Date(data.applicationOpenAt),
        applicationCloseAt: new Date(data.applicationCloseAt),
      };
      if (existing) {
        await updateCohort(existing.id, actor, input);
        toast.success("Cohort updated");
      } else {
        await createCohort(actor, input);
        toast.success("Cohort created as draft");
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save cohort");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Cohort name</Label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sectorFocus">Sector focus (comma-separated)</Label>
        <Input id="sectorFocus" placeholder="AgriTech, FoodTech, DeepTech" {...form.register("sectorFocus")} />
        {form.formState.errors.sectorFocus && (
          <p className="text-sm text-destructive">{form.formState.errors.sectorFocus.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="applicationOpenAt">Applications open</Label>
          <Input id="applicationOpenAt" type="date" {...form.register("applicationOpenAt")} />
          {form.formState.errors.applicationOpenAt && (
            <p className="text-sm text-destructive">
              {form.formState.errors.applicationOpenAt.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="applicationCloseAt">Applications close</Label>
          <Input id="applicationCloseAt" type="date" {...form.register("applicationCloseAt")} />
          {form.formState.errors.applicationCloseAt && (
            <p className="text-sm text-destructive">
              {form.formState.errors.applicationCloseAt.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="capacity">Capacity</Label>
        <Input id="capacity" type="number" min={1} {...form.register("capacity")} />
        {form.formState.errors.capacity && (
          <p className="text-sm text-destructive">{form.formState.errors.capacity.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="eligibilityRules">Eligibility rules</Label>
        <Textarea id="eligibilityRules" rows={3} {...form.register("eligibilityRules")} />
        {form.formState.errors.eligibilityRules && (
          <p className="text-sm text-destructive">
            {form.formState.errors.eligibilityRules.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="scoringRubric">Scoring rubric</Label>
        <Textarea id="scoringRubric" rows={3} {...form.register("scoringRubric")} />
        {form.formState.errors.scoringRubric && (
          <p className="text-sm text-destructive">{form.formState.errors.scoringRubric.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : existing ? "Save changes" : "Create cohort"}
        </Button>
      </div>
    </form>
  );
}
