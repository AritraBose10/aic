"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { mfaRequiredFor, isMfaEnrolled, startTotpEnrollment, finishTotpEnrollment, type TotpEnrollmentStart } from "@/features/auth/lib/mfaActions";

/**
 * SEC-04 TOTP enrolment card. Inert until Identity Platform is enabled — the SDK
 * calls surface a clear message if it isn't. Shown to admin/cohort_manager.
 */
export function MfaSetupCard() {
  const { userDoc, firebaseUser } = useAuth();
  const [start, setStart] = useState<TotpEnrollmentStart | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const enrolled = !!firebaseUser && isMfaEnrolled(firebaseUser);

  if (!userDoc || !firebaseUser) return null;
  const required = mfaRequiredFor(userDoc.role);
  if (!required && !enrolled) return null; // only surface for privileged roles

  async function begin() {
    setBusy(true);
    try { setStart(await startTotpEnrollment(auth.currentUser!)); }
    catch (e) { toast.error(e instanceof Error && /operation-not-allowed/.test(e.message) ? "MFA isn't enabled yet (needs Identity Platform)." : "Could not start enrolment"); }
    finally { setBusy(false); }
  }
  async function finish() {
    if (!start) return;
    setBusy(true);
    try { await finishTotpEnrollment(auth.currentUser!, start.secret, code); toast.success("Two-factor enabled"); setStart(null); setCode(""); }
    catch { toast.error("Invalid code — try again"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Two-factor authentication</CardTitle>
          <CardDescription>Required for admin & cohort-manager accounts (SEC-04).</CardDescription>
        </div>
        {enrolled && <Badge variant="secondary" className="bg-success/10 text-success"><ShieldCheck className="size-3" /> Enabled</Badge>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {enrolled ? (
          <p className="text-muted-foreground">An authenticator app is protecting your account.</p>
        ) : !start ? (
          <>
            {required && <p className="text-muted-foreground">Your role should protect sign-in with an authenticator app.</p>}
            <Button size="sm" variant="outline" disabled={busy} onClick={begin}><KeyRound className="size-4" /> Set up authenticator</Button>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground">Scan this in your authenticator app, then enter the 6-digit code.</p>
            <code className="block break-all rounded-md border border-border bg-muted/40 p-2 text-xs">{start.secretKey}</code>
            <div className="flex items-end gap-2">
              <div className="space-y-1"><Label className="text-xs">Code</Label><Input className="w-32" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" /></div>
              <Button size="sm" disabled={busy || code.length < 6} onClick={finish}>Verify & enable</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
