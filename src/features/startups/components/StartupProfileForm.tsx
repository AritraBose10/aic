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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { createStartup, updateStartupProfile } from "@/features/startups/lib/startupActions";
import type { StartupDoc } from "@/core/types";

const schema = z.object({
  name: z.string().min(2, "Startup name is required"),
  sector: z.string().min(2, "Sector is required"),
  district: z.string().min(2, "District is required"),
  stage: z.string().min(2, "Stage is required"),
  description: z.string().min(10, "Give a short description (10+ characters)").max(1000),
});

type FormValues = z.infer<typeof schema>;

interface StartupProfileFormProps {
  existing?: StartupDoc | null;
  onDone?: () => void;
}

export function StartupProfileForm({ existing, onDone }: StartupProfileFormProps) {
  const { userDoc } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      sector: existing?.sector ?? "",
      district: existing?.district ?? "",
      stage: existing?.stage ?? "",
      description: existing?.description ?? "",
    },
  });

  async function onSubmit(data: FormValues) {
    if (!userDoc) return;
    setSubmitting(true);
    try {
      const actor = { uid: userDoc.uid, role: userDoc.role };
      if (existing) {
        await updateStartupProfile(existing.id, actor, data);
        toast.success("Startup profile updated");
      } else {
        await createStartup(actor, data);
        toast.success("Startup profile created");
      }
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{existing ? "Edit startup profile" : "Create your startup profile"}</CardTitle>
        <CardDescription>
          {existing
            ? "Keep this up to date — it's what evaluators and admins see."
            : "This is the profile you'll use when applying to cohorts."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Startup name</Label>
              <Input id="name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector">Sector</Label>
              <Input id="sector" {...form.register("sector")} />
              {form.formState.errors.sector && (
                <p className="text-sm text-destructive">{form.formState.errors.sector.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input id="district" {...form.register("district")} />
              {form.formState.errors.district && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.district.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage">Stage</Label>
              <Input id="stage" placeholder="Idea, MVP, Revenue..." {...form.register("stage")} />
              {form.formState.errors.stage && (
                <p className="text-sm text-destructive">{form.formState.errors.stage.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={4} {...form.register("description")} />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            {existing && onDone && (
              <Button type="button" variant="outline" onClick={onDone}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : existing ? "Save changes" : "Create profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
