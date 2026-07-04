"use client";

import { LineChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useKpiSnapshots } from "@/features/startups/hooks/useKpiSnapshots";

export function KpiHistory({ startupId }: { startupId: string }) {
  const { snapshots, loading } = useKpiSnapshots(startupId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>KPI history</CardTitle>
        <CardDescription>Append-only snapshots — the baseline is never overwritten.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading snapshots...</p>
        ) : snapshots.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <LineChart className="size-8" />
            <p className="text-sm">No KPI snapshots captured yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Captured</TableHead>
                <TableHead>Revenue band</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Funds raised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((snapshot) => (
                <TableRow key={snapshot.id}>
                  <TableCell className="text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {snapshot.capturedAt?.toDate().toLocaleDateString() ?? "—"}
                      {snapshot.isBaseline && (
                        <Badge variant="secondary" className="bg-accent text-accent-foreground">
                          Baseline
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{snapshot.revenueBand}</TableCell>
                  <TableCell>{snapshot.customers}</TableCell>
                  <TableCell>{snapshot.teamSize}</TableCell>
                  <TableCell>₹{snapshot.fundsRaised.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
