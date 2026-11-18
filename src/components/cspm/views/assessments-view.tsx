"use client";

import { useEffect, useState, useCallback } from "react";
import { Play, Loader2, RefreshCw, History, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDate } from "../lib";

interface Assessment {
  id: string;
  status: string;
  trigger: string;
  totalChecks: number;
  passed: number;
  failed: number;
  errors: number;
  durationMs: number;
  startedAt: string;
  completedAt?: string | null;
}

export function AssessmentsView({ onAssessmentRun }: { onAssessmentRun?: () => void }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/cspm/assessments")
      .then((r) => r.json())
      .then((d) => setAssessments(d.assessments ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runAssessment() {
    setRunning(true);
    try {
      const res = await fetch("/api/cspm/assessments/run", { method: "POST" });
      if (!res.ok) throw new Error("Run failed");
      const data = await res.json();
      toast.success(`Assessment complete · score ${data.score}/100 · ${data.failed} findings`);
      load();
      onAssessmentRun?.();
    } catch {
      toast.error("Could not run assessment");
    } finally {
      setRunning(false);
    }
  }

  const latest = assessments[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-emerald-600" /> Assessment Runs
              </CardTitle>
              <CardDescription>
                Re-evaluate the latest read-only snapshot against the documented checks library.
              </CardDescription>
            </div>
            <Button onClick={runAssessment} disabled={running} className="gap-2">
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running ? "Running assessment..." : "Run assessment"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {latest && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Latest score" value={`${latest.totalChecks ? Math.round((latest.passed / latest.totalChecks) * 100) : 0}%`} />
              <Metric label="Passed" value={latest.passed} accent="text-emerald-600" />
              <Metric label="Failed" value={latest.failed} accent="text-rose-600" />
              <Metric label="Duration" value={`${latest.durationMs}ms`} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Run history</CardTitle>
          <CardDescription>Most recent assessments first</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Started</th>
                  <th className="px-4 py-3 font-medium">Trigger</th>
                  <th className="px-4 py-3 font-medium">Checks</th>
                  <th className="px-4 py-3 font-medium">Passed</th>
                  <th className="px-4 py-3 font-medium">Failed</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={8} className="px-4 py-4"><Skeleton className="h-6" /></td>
                    </tr>
                  ))
                ) : assessments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No assessment runs yet.
                    </td>
                  </tr>
                ) : (
                  assessments.map((a) => (
                    <tr key={a.id} className="border-b transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3">
                        {a.status === "completed" ? (
                          <Badge className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                            <CheckCircle2 className="size-3" /> Completed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <XCircle className="size-3" /> {a.status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(a.startedAt)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">{a.trigger}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">{a.totalChecks}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{a.passed}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-rose-600 dark:text-rose-400">{a.failed}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-muted-foreground">{a.durationMs}ms</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(a.completedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
        <p className="flex items-start gap-2">
          <RefreshCw className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Assessments are point-in-time evaluations of the read-only configuration snapshot.
            They never call write APIs against the cloud account. The snapshot is refreshed during
            the periodic authorized read sync — re-running here only re-evaluates the current
            snapshot against the checks library.
          </span>
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
