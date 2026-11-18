"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Boxes,
  Activity,
  Clock,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatCard, ScoreRing } from "../stat-card";
import { SeverityBadge } from "../badges";
import { scoreColor, formatDate, type Severity } from "../lib";

interface DashboardData {
  account: {
    id: string;
    provider: string;
    accountId: string;
    displayName: string;
    region?: string;
    lastSyncedAt?: string;
  };
  totals: {
    checks: number;
    resources: number;
    findings: number;
    openFindings: number;
    resolvedFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  score: number;
  passRate: number;
  byService: Array<{
    service: string;
    serviceLabel: string;
    total: number;
    passed: number;
    failed: number;
    open: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    score: number;
  }>;
  byStatus: { open: number; in_progress: number; resolved: number; suppressed: number };
  trend: Array<{ takenAt: string; score: number; open: number; resolved: number }>;
  topRisk?: Array<{
    id: string;
    checkId: string;
    title: string;
    severity: Severity;
    riskScore: number;
    resourceName: string;
    resourceType: string;
    service: string;
    serviceLabel: string;
    resourceCriticality: string;
    resourceInternetFacing: boolean;
  }>;
  lastAssessment?: {
    id: string;
    startedAt: string;
    completedAt?: string;
    totalChecks: number;
    passed: number;
    failed: number;
  };
}

const SEV_FILL: Record<Severity, string> = {
  critical: "#f43f5e",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#94a3b8",
};

export function OverviewView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/cspm/dashboard")
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const sevData = (["critical", "high", "medium", "low"] as Severity[]).map((s) => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: data.totals[s],
    severity: s,
    fill: SEV_FILL[s],
  }));

  const trendData = data.trend.map((t) => ({
    date: new Date(t.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: t.score,
    open: t.open,
    resolved: t.resolved,
  }));

  const scoreTrend =
    trendData.length >= 2 ? trendData[trendData.length - 1].score - trendData[0].score : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Compliance Score"
          value={data.score}
          sublabel={`${data.passRate}% controls passing`}
          icon={ShieldCheck}
          accent="text-emerald-600"
          trend={scoreTrend !== 0 ? { value: scoreTrend, positive: scoreTrend > 0 } : undefined}
        />
        <StatCard
          label="Open Findings"
          value={data.totals.openFindings}
          sublabel={`${data.totals.resolvedFindings} resolved to date`}
          icon={ShieldAlert}
          accent="text-rose-600"
        />
        <StatCard
          label="Critical & High"
          value={data.totals.critical + data.totals.high}
          sublabel={`${data.totals.critical} critical · ${data.totals.high} high`}
          icon={AlertTriangle}
          accent="text-orange-600"
        />
        <StatCard
          label="Resources Assessed"
          value={data.totals.resources}
          sublabel={`${data.totals.checks} documented checks`}
          icon={Boxes}
          accent="text-violet-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Posture Score</CardTitle>
            <CardDescription>Weighted compliance across all services</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pt-2">
            <ScoreRing score={data.score} />
            <div className="flex items-center gap-2 text-sm">
              <span className={`text-lg font-semibold ${scoreColor(data.score)}`}>
                {data.score >= 80 ? "Healthy" : data.score >= 60 ? "Needs attention" : "At risk"}
              </span>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Last assessment {formatDate(data.lastAssessment?.startedAt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Findings by Severity</CardTitle>
            <CardDescription>Open failures in the latest assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie
                    data={sevData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {sevData.map((entry) => (
                      <Cell key={entry.severity} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {sevData.map((s) => (
                  <div key={s.severity} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: s.fill }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Remediation Status</CardTitle>
            <CardDescription>Failing findings lifecycle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {([
              ["open", "Open", "text-rose-600"],
              ["in_progress", "In Progress", "text-sky-600"],
              ["resolved", "Resolved", "text-emerald-600"],
              ["suppressed", "Suppressed", "text-slate-500"],
            ] as const).map(([key, label, color]) => {
              const total = Math.max(
                data.byStatus.open + data.byStatus.in_progress + data.byStatus.resolved + data.byStatus.suppressed,
                1
              );
              const v = data.byStatus[key];
              const pct = Math.round((v / total) * 100);
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-semibold tabular-nums ${color}`}>{v}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        key === "open"
                          ? "bg-rose-500"
                          : key === "in_progress"
                          ? "bg-sky-500"
                          : key === "resolved"
                          ? "bg-emerald-500"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Compliance & Remediation Trend</CardTitle>
              <CardDescription>Score and open-finding count over time</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="size-3" />
              {trendData.length} snapshots
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="score"
                name="Score"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#scoreGrad)"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="open"
                name="Open findings"
                stroke="#f43f5e"
                strokeWidth={2}
                fill="url(#openGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Posture by Service</CardTitle>
              <CardDescription>Pass rate and failure severity per cloud service</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => onNavigate("findings")}>
              View findings <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.byService} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
              <XAxis dataKey="serviceLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
              />
              <Bar dataKey="passed" name="Passed" stackId="a" fill="#10b981" />
              <Bar dataKey="critical" name="Critical" stackId="a" fill="#f43f5e" />
              <Bar dataKey="high" name="High" stackId="a" fill="#f97316" />
              <Bar dataKey="medium" name="Medium" stackId="a" fill="#f59e0b" />
              <Bar dataKey="low" name="Low" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Priority risks — business-aware prioritisation */}
      {data.topRisk && data.topRisk.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-rose-600" /> Priority risks
                </CardTitle>
                <CardDescription>
                  Top findings ranked by business-aware risk score (severity × asset criticality × exposure)
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => onNavigate("attack-paths")}>
                Attack paths <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topRisk.map((f, i) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <span className="font-mono text-xs text-muted-foreground">{f.checkId}</span>
                    <span className="truncate text-sm font-medium">{f.title}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <span className="font-mono">{f.resourceType}</span> · {f.resourceName}
                    {f.resourceInternetFacing && (
                      <span className="ml-1 text-rose-600 dark:text-rose-400">· internet-facing</span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                    {f.riskScore}
                  </div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">risk</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-emerald-600" /> Connected Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Account" value={data.account.displayName} />
            <Row label="Provider" value={data.account.provider.toUpperCase()} />
            <Row label="Account ID" value={data.account.accountId} mono />
            <Row label="Region" value={data.account.region ?? "—"} />
            <Row label="Scan mode" value={<Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">Read-only</Badge>} />
            <Row label="Last synced" value={<span className="inline-flex items-center gap-1"><Clock className="size-3 text-muted-foreground" />{formatDate(data.account.lastSyncedAt)}</span>} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-emerald-600" /> Latest Assessment
            </CardTitle>
            <CardDescription>{data.lastAssessment ? formatDate(data.lastAssessment.startedAt) : "No assessments"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.lastAssessment && (
              <>
                <Row label="Total checks" value={data.lastAssessment.totalChecks} />
                <Row label="Passed" value={<span className="text-emerald-600 font-semibold">{data.lastAssessment.passed}</span>} />
                <Row label="Failed" value={<span className="text-rose-600 font-semibold">{data.lastAssessment.failed}</span>} />
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
                <SeverityBadge key={s} severity={s} />
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full gap-1.5" onClick={() => onNavigate("findings")}>
              Review findings <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>{value}</span>
    </div>
  );
}
