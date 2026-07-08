"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { toast } from "sonner";
import { Check, Inbox, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { approveUser, rejectUser } from "@/features/auth/lib/authActions";
import type { UserDoc } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ROLE_LABEL: Record<UserDoc["role"], string> = {
  admin: "Admin",
  cohort_manager: "Cohort Manager",
  evaluator: "Evaluator",
  founder: "Founder",
  investor: "Investor",
  probasi_adopter: "Probasi adopter",
};

export function ApprovalQueue() {
  const { userDoc: approver } = useAuth();
  const [pending, setPending] = useState<UserDoc[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users"), where("approvalStatus", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPending(snap.docs.map((d) => d.data() as UserDoc));
    });
    return unsubscribe;
  }, []);

  async function handleApprove(target: UserDoc) {
    if (!approver) return;
    setBusyUid(target.uid);
    try {
      await approveUser(target.uid, approver.uid, approver.role);
      toast.success(`${target.name} approved`);
    } catch {
      toast.error("Could not approve user");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleReject(target: UserDoc) {
    if (!approver) return;
    setBusyUid(target.uid);
    try {
      await rejectUser(target.uid, approver.uid, approver.role, "Did not meet criteria");
      toast.success(`${target.name} rejected`);
    } catch {
      toast.error("Could not reject user");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending approvals</CardTitle>
        <CardDescription>
          {pending.length === 0
            ? "Nothing waiting on you right now."
            : `${pending.length} account${pending.length === 1 ? "" : "s"} awaiting a decision.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Inbox className="size-8" />
            <p className="text-sm">The approval queue is empty.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {user.registrationNote}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="success"
                      disabled={busyUid === user.uid}
                      onClick={() => handleApprove(user)}
                    >
                      <Check className="size-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyUid === user.uid}
                      onClick={() => handleReject(user)}
                    >
                      <X className="size-4" />
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
