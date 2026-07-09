"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginUser } from "@/features/auth/lib/authActions";
import { getResolver, resolveTotpChallenge } from "@/features/auth/lib/mfaActions";
import type { MultiFactorResolver } from "firebase/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    setSubmitting(true);
    try {
      await loginUser(data.email, data.password);
      router.push("/dashboard");
    } catch (err) {
      // SEC-04: if the account has MFA enrolled, resolve the TOTP challenge.
      const resolver = getResolver(err);
      if (resolver) {
        setMfaResolver(resolver);
      } else {
        toast.error("Invalid email or password");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMfa() {
    if (!mfaResolver) return;
    setSubmitting(true);
    try {
      await resolveTotpChallenge(mfaResolver, mfaCode);
      router.push("/dashboard");
    } catch {
      toast.error("Invalid authentication code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <span className="mb-1 flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="size-4.5" />
        </span>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your Bengal Startup Ecosystem account</CardDescription>
      </CardHeader>
      <CardContent>
        {mfaResolver ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app to finish signing in.
            </p>
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Authentication code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitMfa()}
              />
            </div>
            <Button className="w-full" disabled={submitting || mfaCode.length < 6} onClick={submitMfa}>
              {submitting && <Loader size="sm" />} Verify
            </Button>
          </div>
        ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              aria-invalid={!!form.formState.errors.email}
              aria-describedby={form.formState.errors.email ? "email-error" : undefined}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p id="email-error" role="alert" className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              aria-invalid={!!form.formState.errors.password}
              aria-describedby={form.formState.errors.password ? "password-error" : undefined}
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p id="password-error" role="alert" className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader size="sm" />}
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-foreground hover:underline">
              Register
            </Link>
          </p>
        </form>
        )}
      </CardContent>
    </Card>
  );
}
