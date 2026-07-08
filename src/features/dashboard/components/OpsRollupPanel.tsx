"use client";

import { Briefcase } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAllOpsSummaries } from "@/features/dashboard/hooks/usePortfolio";

const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

/**
 * Portfolio operations rollup (OPS-06) — reads the per-startup opsSummary docs
 * (aggregate only; never the raw CRM/finance collections, which staff can't
 * read). This is where a converted opportunity surfaces on the dashboard (AT-05).
 */
export function OpsRollupPanel() {
  const { summaries, loading } = useAllOpsSummaries();

  const totalPipeline = summaries.reduce((s, r) => s + (r.pipelineValue ?? 0), 0);
  const totalWon = summaries.reduce((s, r) => s + (r.wonValue ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="size-4" /> Startup operations
        </CardTitle>
        <CardDescription>
          Pipeline and finance rollup across the portfolio — aggregates only.
          Total pipeline {inr(totalPipeline)} · won {inr(totalWon)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No operations data yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Startup</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>Won</TableHead>
                <TableHead>Invoiced</TableHead>
                <TableHead>Cash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.startupName}</TableCell>
                  <TableCell className="tabular-nums">{inr(r.pipelineValue)}</TableCell>
                  <TableCell className="tabular-nums">{r.openOpportunities ?? 0}</TableCell>
                  <TableCell className="tabular-nums">{inr(r.wonValue)}</TableCell>
                  <TableCell className="tabular-nums">{inr(r.invoicedTotal)}</TableCell>
                  <TableCell className="tabular-nums">{inr(r.cashPosition)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
