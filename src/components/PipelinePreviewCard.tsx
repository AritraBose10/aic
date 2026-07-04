import { Building2, CircleDot, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const ROWS: { name: string; sector: string; status: "Submitted" | "Under review" | "Selected" }[] = [
  { name: "Sundarban AgriTech", sector: "AgriTech", status: "Selected" },
  { name: "Kolkata Craft Collective", sector: "D2C", status: "Under review" },
  { name: "Howrah Robotics Lab", sector: "DeepTech", status: "Under review" },
  { name: "Digha Blue Foods", sector: "FoodTech", status: "Submitted" },
];

const STATUS_STYLE: Record<(typeof ROWS)[number]["status"], string> = {
  Selected: "bg-success/10 text-success",
  "Under review": "bg-accent text-accent-foreground",
  Submitted: "bg-muted text-muted-foreground",
};

export function PipelinePreviewCard() {
  return (
    <Card className="w-full max-w-sm border-border/60 shadow-xl shadow-slate-900/5">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="size-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">Cohort pipeline</p>
            <p className="mt-1 text-xs text-muted-foreground">Winter 2026</p>
          </div>
        </div>
        <MoreHorizontal className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-1 pt-4">
        {ROWS.map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-muted"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.sector}</p>
            </div>
            <Badge variant="secondary" className={`shrink-0 gap-1 ${STATUS_STYLE[row.status]}`}>
              <CircleDot className="size-2.5" />
              {row.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
