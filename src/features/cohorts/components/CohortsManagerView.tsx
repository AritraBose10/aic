"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarRange, ClipboardList, Layers, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useCohorts } from "@/features/cohorts/hooks/useCohorts";
import { setCohortStatus } from "@/features/cohorts/lib/cohortActions";
import { CohortForm } from "@/features/cohorts/components/CohortForm";
import type { CohortDoc, CohortStatus } from "@/core/types";

const STATUS_STYLE: Record<CohortStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-success/10 text-success",
  closed: "bg-secondary text-secondary-foreground",
};

export function CohortsManagerView() {
  const { userDoc } = useAuth();
  const { cohorts, loading } = useCohorts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CohortDoc | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(cohort: CohortDoc) {
    setEditing(cohort);
    setDialogOpen(true);
  }

  async function handleStatusChange(cohort: CohortDoc, status: CohortStatus) {
    if (!userDoc) return;
    try {
      await setCohortStatus(cohort.id, { uid: userDoc.uid, role: userDoc.role }, status);
    } catch {
      toast.error("Could not update cohort status");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cohorts</CardTitle>
          <CardDescription>Create and manage cohort calls for applicants.</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          New cohort
        </Button>
      </CardHeader>
      <CardContent>
        {!loading && cohorts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Layers className="size-8" />
            <p className="text-sm">No cohorts yet. Create one to open applications.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Sectors</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.map((cohort) => (
                <TableRow key={cohort.id}>
                  <TableCell className="font-medium">{cohort.name}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {cohort.sectorFocus.join(", ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-sm">
                      <CalendarRange className="size-3.5" />
                      {cohort.applicationOpenAt.toDate().toLocaleDateString()} –{" "}
                      {cohort.applicationCloseAt.toDate().toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>{cohort.capacity}</TableCell>
                  <TableCell>
                    <Select
                      value={cohort.status}
                      onValueChange={(v) => handleStatusChange(cohort, v as CohortStatus)}
                    >
                      <SelectTrigger
                        className={`h-7 w-28 border-transparent font-medium capitalize ${STATUS_STYLE[cohort.status]}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Link
                      href={`/cohorts/${cohort.id}/applications`}
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                    >
                      <ClipboardList className="size-4" />
                      Review
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => openEdit(cohort)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit cohort" : "Create cohort"}</DialogTitle>
          </DialogHeader>
          <CohortForm existing={editing} onDone={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
