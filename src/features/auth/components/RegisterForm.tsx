"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerUser } from "@/features/auth/lib/authActions";
import { cn } from "@/lib/utils";
import type { Role } from "@/core/types";

const ROLE_OPTIONS: { value: Exclude<Role, "admin">; label: string; note: string }[] = [
  {
    value: "founder",
    label: "Founder / Applicant",
    note: "Applying to a cohort or running a startup in the ecosystem.",
  },
  {
    value: "evaluator",
    label: "Selection Evaluator",
    note: "Reviewing and scoring cohort applications.",
  },
  {
    value: "cohort_manager",
    label: "Cohort Manager",
    note: "Running cohorts and managing the applicant pipeline.",
  },
];

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  phone: z.string().optional(),
  role: z.enum(["founder", "evaluator", "cohort_manager"]),
  registrationNote: z.string().min(1, "Tell us a bit more").max(500),
});

type FormValues = z.infer<typeof schema>;

const STEPS = ["Account", "Role", "Details", "Review"] as const;

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      role: "founder",
      registrationNote: "",
    },
    mode: "onBlur",
  });

  const values = form.watch();

  const stepFields: Record<number, (keyof FormValues)[]> = {
    0: ["name", "email", "password", "phone"],
    1: ["role"],
    2: ["registrationNote"],
    3: [],
  };

  async function goNext() {
    const valid = await form.trigger(stepFields[step]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(data: FormValues) {
    setSubmitting(true);
    try {
      await registerUser(data);
      toast.success("Registration submitted — an admin will review your account.");
      router.push("/pending-approval");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const roleNote = ROLE_OPTIONS.find((r) => r.value === values.role)?.note;

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="size-4.5" />
          </span>
          <div>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Step {step + 1} of {STEPS.length} &middot; {STEPS[step]}
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <form id="register-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...form.register("password")} />
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  Phone <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input id="phone" {...form.register("phone")} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <Label>I am registering as a</Label>
              <Select
                value={values.role}
                onValueChange={(v) => form.setValue("role", v as FormValues["role"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roleNote && (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  {roleNote}
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-1.5">
              <Label htmlFor="registrationNote">
                {values.role === "founder"
                  ? "Briefly describe your startup or idea"
                  : values.role === "evaluator"
                    ? "Your affiliation and area of expertise"
                    : "Your organisation and role"}
              </Label>
              <Textarea id="registrationNote" rows={5} {...form.register("registrationNote")} />
              {form.formState.errors.registrationNote && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.registrationNote.message}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="divide-y divide-border overflow-hidden rounded-lg border text-sm">
                <div className="flex items-center justify-between gap-4 px-3 py-2">
                  <span className="text-muted-foreground">Name</span>
                  <span className="text-right font-medium">{values.name}</span>
                </div>
                <div className="flex items-center justify-between gap-4 px-3 py-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="text-right font-medium">{values.email}</span>
                </div>
                <div className="flex items-center justify-between gap-4 px-3 py-2">
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-right font-medium">
                    {ROLE_OPTIONS.find((r) => r.value === values.role)?.label}
                  </span>
                </div>
                <div className="flex flex-col gap-1 px-3 py-2">
                  <span className="text-muted-foreground">Details</span>
                  <span className="font-medium">{values.registrationNote}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Your account needs admin approval before you can sign in.
              </p>
            </div>
          )}
        </form>
      </CardContent>
      <CardFooter className="justify-between">
        <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={goNext}>
            Next
          </Button>
        ) : (
          <Button type="submit" form="register-form" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit registration"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
