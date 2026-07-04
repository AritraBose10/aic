"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { logoutUser } from "@/features/auth/lib/authActions";

export default function PendingApprovalPage() {
  const { firebaseUser, userDoc, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (userDoc?.approvalStatus === "approved") {
      router.replace("/dashboard");
    }
  }, [loading, firebaseUser, userDoc, router]);

  if (loading || !userDoc) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const isRejected = userDoc.approvalStatus === "rejected";

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span
            className={
              isRejected
                ? "mb-1 flex size-9 items-center justify-center rounded-md bg-destructive/10 text-destructive"
                : "mb-1 flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground"
            }
          >
            {isRejected ? <XCircle className="size-4.5" /> : <Clock className="size-4.5" />}
          </span>
          <CardTitle>{isRejected ? "Registration not approved" : "Awaiting approval"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRejected ? (
            <p className="text-sm text-muted-foreground">
              {userDoc.rejectionReason ?? "Your registration was not approved."}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Thanks for registering, {userDoc.name}. An admin needs to approve your account
              before you can access the platform. You&apos;ll be able to sign in as soon as
              that happens.
            </p>
          )}
          <Button variant="outline" onClick={() => logoutUser()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
