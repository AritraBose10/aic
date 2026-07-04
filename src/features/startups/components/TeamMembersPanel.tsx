"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  inviteTeamMember,
  reactivateTeamMember,
  suspendTeamMember,
} from "@/features/startups/lib/startupActions";
import type { StartupDoc, StartupTeamAccessRole } from "@/core/types";

const ACCESS_ROLE_LABEL: Record<StartupTeamAccessRole, string> = {
  co_founder: "Co-founder",
  finance: "Finance",
  sales: "Sales",
  operations: "Operations",
};

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  accessRole: z.enum(["co_founder", "finance", "sales", "operations"]),
});

type FormValues = z.infer<typeof schema>;

export function TeamMembersPanel({ startup }: { startup: StartupDoc }) {
  const { userDoc } = useAuth();
  const [inviting, setInviting] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", accessRole: "co_founder" },
  });

  async function onInvite(data: FormValues) {
    if (!userDoc) return;
    setInviting(true);
    try {
      await inviteTeamMember(
        startup.id,
        { uid: userDoc.uid, role: userDoc.role },
        data.email,
        data.accessRole,
      );
      toast.success("Team member added");
      form.reset({ email: "", accessRole: "co_founder" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add team member");
    } finally {
      setInviting(false);
    }
  }

  async function toggleStatus(targetUid: string, currentlyActive: boolean) {
    if (!userDoc) return;
    setBusyUid(targetUid);
    try {
      const actor = { uid: userDoc.uid, role: userDoc.role };
      if (currentlyActive) {
        await suspendTeamMember(startup.id, actor, targetUid);
      } else {
        await reactivateTeamMember(startup.id, actor, targetUid);
      }
    } catch {
      toast.error("Could not update team member");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team access</CardTitle>
        <CardDescription>
          Delegate access to co-founders, finance, sales, or operations team members. They must
          already have an approved account on the platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={form.handleSubmit(onInvite)}
          className="flex flex-wrap items-end gap-3 rounded-md border p-4"
        >
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" placeholder="teammate@example.com" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Access role</Label>
            <Select
              value={form.watch("accessRole")}
              onValueChange={(v) => form.setValue("accessRole", v as FormValues["accessRole"])}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCESS_ROLE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={inviting}>
            <UserPlus className="size-4" />
            {inviting ? "Adding..." : "Add to team"}
          </Button>
        </form>

        {startup.teamMembers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <Users className="size-8" />
            <p className="text-sm">No team members yet.</p>
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {startup.teamMembers.map((member) => {
              const isActive = member.status === "active";
              return (
                <TableRow key={member.uid}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>{ACCESS_ROLE_LABEL[member.accessRole]}</TableCell>
                  <TableCell>
                    <Badge
                      variant={isActive ? "secondary" : "outline"}
                      className={isActive ? "bg-success/10 text-success" : "text-muted-foreground"}
                    >
                      {isActive ? "Active" : "Suspended"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyUid === member.uid}
                      onClick={() => toggleStatus(member.uid, isActive)}
                    >
                      {isActive ? "Suspend" : "Reactivate"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>
  );
}
