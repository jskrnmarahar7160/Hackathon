"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows, TrendingUp, TrendingDown, Minus, ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "../badges";
import { formatDate } from "../lib";

interface DeltaFinding {
  checkId: string;
  title: string;
  service: string;
  resourceName: string;
  resourceType: string;
  severity: "critical" | "high" | "medium" | "low";
  classification: "new" | "resolved" | "recurring";
  prevStatus?: string;
  currStatus?: string;
}

interface Delta {
  previousAssessment: { id: string; startedAt: string; score: number };
  currentAssessment: { id: string; startedAt: string; score: number };
  scoreDelta: number;
  newFindings: DeltaFinding[];
  resolvedFindings: DeltaFinding[];
  recurringFindings: DeltaFinding[];
  totals: { new: number; resolved: number; recurring: number; netChange: number };
  byService: Array<{ service: string; new: number; resolved: number; recurring: number }>;
}

const CLASSIFICATION_META = {
  new: { label: "New", icon: TrendingUp, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-900" },
  resolved: { label: "Resolved", icon: TrendingDown, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-900" },
  recurring: { label: "Recurring", icon: Minus, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-900" },
} as const;

export function DeltaView() {
  const [delta, setDelta] = useState<Delta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cspm/delta")
      .then((r) => r.json())
      .then((d) => setDelta(d.delta ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  if (!delta) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Need at least two assessments to compute drift.
        </CardContent>
      </Card>
    );
  }

  const improving = delta.totals.netChange > 0;
  const flat = delta.totals.netChange === 0;

  return (
    <div className="space-y-4">
      {/* Hero comparison */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <GitCompareArrows className="size-4 text-violet-600" /> Posture drift
              </CardTitle>
              <CardDescription>Comparing the two most recent assessments</CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                improving
                  ? "border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
                  : flat
                  ? "border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300"
                  : "border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300"
              }
            >
              {improving ? "Improving" : flat ? "Flat" : "Regressing"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
            {/* Previous */}
            <div className="rounded-lg border p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Previous assessment</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(delta.previousAssessment.startedAt)}</p>
              <p className="mt-2 text-4xl font-semibold tabular-nums text-muted-foreground">
                {delta.previousAssessment.score}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">score</p>
            </div>
            {/* Arrow + delta */}
            <div className="flex flex-col items-center">
              <ArrowRight className="size-6 rotate-90 text-muted-foreground/40 sm:rotate-0" />
              <span
                className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  improving
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : flat
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                }`}
              >
                {delta.scoreDelta > 0 ? "+" : ""}{delta.scoreDelta} pts
              </span>
            </div>
            {/* Current */}
            <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-4 text-center dark:border-emerald-900 dark:bg-emerald-950/20">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current assessment</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(delta.currentAssessment.startedAt)}</p>
              <p className="mt-2 text-4xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {delta.currentAssessment.score}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">score</p>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="New" value={delta.totals.new} icon={TrendingUp} color="text-rose-600" />
            <Stat label="Resolved" value={delta.totals.resolved} icon={TrendingDown} color="text-emerald-600" />
            <Stat label="Recurring" value={delta.totals.recurring} icon={Clock} color="text-amber-600" />
          </div>
        </CardContent>
      </Card>

      {/* By service */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Drift by service</CardTitle>
          <CardDescription>Where new issues appeared and where they were fixed</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium text-rose-600">New</th>
                  <th className="px-4 py-3 font-medium text-emerald-600">Resolved</th>
                  <th className="px-4 py-3 font-medium text-amber-600">Recurring</th>
                </tr>
              </thead>
              <tbody>
                {delta.byService.map((s) => (
                  <tr key={s.service} className="border-b">
                    <td className="px-4 py-3 font-medium capitalize">{s.service}</td>
                    <td className="px-4 py-3 tabular-nums text-rose-600 dark:text-rose-400">{s.new || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-emerald-600 dark:text-emerald-400">{s.resolved || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-amber-600 dark:text-amber-400">{s.recurring || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New findings */}
      {delta.newFindings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-rose-600" /> New findings ({delta.newFindings.length})
            </CardTitle>
            <CardDescription>Failures introduced since the previous assessment — emerging risk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {delta.newFindings.map((f, i) => <DeltaRow key={`n-${i}`} f={f} />)}
          </CardContent>
        </Card>
      )}

      {/* Resolved */}
      {delta.resolvedFindings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="size-4 text-emerald-600" /> Resolved findings ({delta.resolvedFindings.length})
            </CardTitle>
            <CardDescription>Previously failing checks now passing — remediation progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {delta.resolvedFindings.map((f, i) => <DeltaRow key={`r-${i}`} f={f} />)}
          </CardContent>
        </Card>
      )}

      {/* Recurring */}
      {delta.recurringFindings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-amber-600" /> Recurring findings ({delta.recurringFindings.length})
            </CardTitle>
            <CardDescription>Still failing — persistent risk requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {delta.recurringFindings.slice(0, 12).map((f, i) => <DeltaRow key={`c-${i}`} f={f} />)}
            {delta.recurringFindings.length > 12 && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                + {delta.recurringFindings.length - 12} more recurring findings
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeltaRow({ f }: { f: DeltaFinding }) {
  const meta = CLASSIFICATION_META[f.classification];
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${meta.bg} ${meta.border}`}>
      <meta.icon className={`size-4 shrink-0 ${meta.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={f.severity} />
          <span className="font-mono text-xs text-muted-foreground">{f.checkId}</span>
          <span className="text-sm font-medium">{f.title}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{f.resourceType}</span> · {f.resourceName}
        </p>
      </div>
      {f.prevStatus && f.currStatus && (
        <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
          <Badge variant="outline" className="capitalize text-xs">{f.prevStatus}</Badge>
          <ArrowRight className="size-3" />
          <Badge variant="outline" className="capitalize text-xs">{f.currStatus}</Badge>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <Icon className={`mx-auto size-4 ${color}`} />
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
