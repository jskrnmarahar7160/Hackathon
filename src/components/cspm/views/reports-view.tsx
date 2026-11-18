"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileJson,
  FileText,
  Download,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "../badges";
import { scoreColor, formatDate } from "../lib";

interface AssessmentReport {
  schemaVersion: string;
  generatedAt: string;
  account: { provider: string; accountId: string; displayName: string; region?: string | null };
  assessment: { id: string; startedAt: string; completedAt?: string | null; durationMs: number };
  executiveSummary: {
    score: number;
    passRate: number;
    totalChecks: number;
    passed: number;
    failed: number;
    criticalFindings: number;
    highFindings: number;
    headline: string;
    narrative: string;
  };
  postureByService: Array<{
    service: string;
    serviceLabel: string;
    total: number;
    passed: number;
    failed: number;
    score: number;
    topFinding?: string;
  }>;
  controlMapping: Array<{
    checkId: string;
    service: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    cisBenchmark?: string | null;
    iso27001Controls?: string | null;
    failedInstances: number;
  }>;
  prioritizedRemediation: Array<{
    checkId: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    resourceName: string;
    remediationGuidance: string;
    remediationEffort: string;
  }>;
  scopeAndLimitations: string[];
  disclaimer: string;
}

export function ReportsView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/cspm/reports/assessment")
      .then((r) => r.json())
      .then((d) => setReport(d))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function download(kind: "evidence" | "assessment") {
    setDownloading(kind);
    try {
      const url = `/api/cspm/reports/${kind}?download=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const filename = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1]
        ?? `cspm-${kind}-${new Date().toISOString().slice(0, 10)}.json`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Download cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                  <FileJson className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Evidence Pack</CardTitle>
                  <CardDescription>Structured JSON · machine-readable</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Every finding with its raw evidence, control mappings, and the read-only account
              and assessment context. Intended for auditors and downstream tooling.
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>· All findings with observed vs. expected evidence</li>
              <li>· Raw resource configuration per finding</li>
              <li>· CIS / ISO 27001 control mapping index</li>
              <li>· Read-only scope notice</li>
            </ul>
            <Button onClick={() => download("evidence")} disabled={downloading === "evidence"} className="w-full gap-2">
              {downloading === "evidence" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download evidence pack (.json)
            </Button>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <FileText className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Assessment Report</CardTitle>
                  <CardDescription>Executive + technical summary</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Executive summary, posture by service, control mapping table, prioritized
              remediation plan, and the documented scope and limitations.
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>· Weighted compliance score & narrative</li>
              <li>· Posture breakdown by service</li>
              <li>· Prioritized remediation actions</li>
              <li>· Read-only scope & limitations</li>
            </ul>
            <div className="flex gap-2">
              <Button onClick={() => download("assessment")} disabled={downloading === "assessment"} variant="default" className="flex-1 gap-2">
                {downloading === "assessment" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Download (.json)
              </Button>
              <Button variant="outline" onClick={() => onNavigate("architecture")} className="gap-1.5">
                <ExternalLink className="size-4" /> Architecture
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assessment report inline */}
      {loading ? (
        <Skeleton className="h-96" />
      ) : report ? (
        <div className="space-y-4">
          {/* Executive summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Executive Summary</CardTitle>
                  <CardDescription>
                    {report.account.displayName} · generated {formatDate(report.generatedAt)}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-semibold tabular-nums ${scoreColor(report.executiveSummary.score)}`}>
                    {report.executiveSummary.score}
                  </div>
                  <div className="text-xs text-muted-foreground">compliance score</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="flex items-start gap-2 text-sm font-medium">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  {report.executiveSummary.headline}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{report.executiveSummary.narrative}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Pass rate" value={`${report.executiveSummary.passRate}%`} accent="text-emerald-600" />
                <Metric label="Critical findings" value={report.executiveSummary.criticalFindings} accent="text-rose-600" />
                <Metric label="High findings" value={report.executiveSummary.highFindings} accent="text-orange-600" />
                <Metric label="Total checks" value={report.executiveSummary.totalChecks} />
              </div>
            </CardContent>
          </Card>

          {/* Posture by service */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Posture by Service</CardTitle>
              <CardDescription>Pass rate and top finding per cloud service</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Service</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Passed</th>
                      <th className="px-4 py-3 font-medium">Failed</th>
                      <th className="px-4 py-3 font-medium">Top finding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.postureByService.map((s) => (
                      <tr key={s.service} className="border-b">
                        <td className="px-4 py-3 font-medium">{s.serviceLabel}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold tabular-nums ${scoreColor(s.score)}`}>{s.score}%</span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-emerald-600 dark:text-emerald-400">{s.passed}</td>
                        <td className="px-4 py-3 tabular-nums text-rose-600 dark:text-rose-400">{s.failed}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.topFinding ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Control mapping */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Control Mapping</CardTitle>
              <CardDescription>Failed checks mapped to CIS Benchmark and ISO 27001 references</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Check</th>
                      <th className="px-4 py-3 font-medium">Severity</th>
                      <th className="px-4 py-3 font-medium">Failed</th>
                      <th className="px-4 py-3 font-medium">CIS reference</th>
                      <th className="px-4 py-3 font-medium">ISO 27001</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.controlMapping.map((c) => (
                      <tr key={c.checkId} className="border-b align-top">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">{c.checkId}</span>
                          <p className="font-medium leading-tight">{c.title}</p>
                        </td>
                        <td className="px-4 py-3"><SeverityBadge severity={c.severity} /></td>
                        <td className="px-4 py-3 tabular-nums">{c.failedInstances}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.cisBenchmark ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.iso27001Controls ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Prioritized remediation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-emerald-600" /> Prioritized Remediation
              </CardTitle>
              <CardDescription>Top open findings ordered by severity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.prioritizedRemediation.map((r, i) => (
                <div key={`${r.checkId}-${r.resourceName}-${i}`} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={r.severity} />
                        <span className="font-mono text-xs text-muted-foreground">{r.checkId}</span>
                      </div>
                      <p className="mt-1 font-medium leading-tight">{r.title}</p>
                      <p className="text-xs text-muted-foreground">on {r.resourceName}</p>
                    </div>
                    <Badge variant="outline" className="capitalize shrink-0">{r.remediationEffort}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.remediationGuidance}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Scope & limitations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="size-4 text-sky-600" /> Scope & Limitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {report.scopeAndLimitations.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    {i % 2 === 0 ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-500" />}
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                {report.disclaimer}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
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
