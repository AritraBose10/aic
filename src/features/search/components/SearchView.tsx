"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { can } from "@/core/roles/permissions";
import { searchQuery, type SearchResult } from "@/core/search";

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-success/10 text-success",
  medium: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  low: "bg-muted text-muted-foreground",
};

export function SearchView() {
  const { userDoc } = useAuth();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  if (!userDoc) return null;
  if (!can(userDoc.role, "search:query")) {
    return <p className="text-sm text-muted-foreground">AI search is not available for your role.</p>;
  }

  async function run() {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setResult(await searchQuery(q));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask the ecosystem</CardTitle>
          <CardDescription>
            Natural-language search across records you&apos;re authorised to see. Results you can&apos;t
            access are filtered out server-side before the AI ever sees them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. which AgriTech startups are raising?"
            onKeyDown={(e) => e.key === "Enter" && run()} />
          <Button onClick={run} disabled={busy || !q.trim()}><Search className="size-4" /> Search</Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Answer</CardTitle>
            <Badge variant="secondary" className={CONFIDENCE_STYLE[result.confidence]}>
              <ShieldCheck className="size-3" /> {result.confidence} confidence
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap">{result.answer}</p>
            {result.citations.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
                <ul className="mt-1 space-y-1">
                  {result.citations.map((c, i) => (
                    <li key={c.sourceId} className="text-xs text-muted-foreground">[{i + 1}] {c.sourceType}: {c.title}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{result.limitations}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
