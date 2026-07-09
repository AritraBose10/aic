"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, LogOut, ShieldAlert, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { logoutUser } from "@/features/auth/lib/authActions";
import { revokeMySessions } from "@/features/auth/lib/sessionActions";
import { exportMyData, downloadJson, deactivateMyAccount } from "@/features/account/lib/accountActions";
import { MfaSetupCard } from "@/features/auth/components/MfaSetupCard";

export function AccountView() {
  const { userDoc } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  if (!userDoc) return null;

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try { await fn(); toast.success(ok); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Action failed (may require the Blaze deploy)"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      {/* MFA (SEC-04) — privileged roles */}
      <MfaSetupCard />

      {/* Security (SEC-05) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Your session signs out automatically after 30 minutes of inactivity.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => logoutUser()}>
            <LogOut className="size-4" /> Sign out this device
          </Button>
          <Button variant="outline" size="sm" disabled={busy === "revoke"}
            onClick={() => run("revoke", () => revokeMySessions(), "Signed out of all devices")}>
            <ShieldAlert className="size-4" /> Sign out of all devices
          </Button>
        </CardContent>
      </Card>

      {/* Data subject requests (§9.2) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your data</CardTitle>
          <CardDescription>Export a copy of your data, or deactivate your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" disabled={busy === "export"}
            onClick={() => run("export", async () => {
              const bundle = await exportMyData(userDoc);
              downloadJson(`my-data-${userDoc.uid}.json`, bundle);
            }, "Export downloaded")}>
            <Download className="size-4" /> Export my data (JSON)
          </Button>

          <div className="rounded-md border border-destructive/30 p-3">
            <p className="text-sm font-medium text-destructive">Deactivate account</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Freezes your access and signs you out everywhere. Your records are retained for audit and
              outcome history; contact an admin for full erasure.
            </p>
            {!confirmDeactivate ? (
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setConfirmDeactivate(true)}>
                <UserX className="size-4" /> Deactivate…
              </Button>
            ) : (
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmDeactivate(false)}>Cancel</Button>
                <Button variant="destructive" size="sm" disabled={busy === "deactivate"}
                  onClick={() => run("deactivate", async () => { await deactivateMyAccount(); await logoutUser(); }, "Account deactivated")}>
                  Confirm deactivation
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
