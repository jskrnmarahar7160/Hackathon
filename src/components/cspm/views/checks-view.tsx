"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, BookOpen, AlertCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SeverityBadge } from "../badges";
import { SERVICE_META } from "../lib";

interface Check {
  id: string;
  checkId: string;
  service: string;
  serviceLabel: string;
  title: string;
  description: string;
  rationale: string;
  severity: "critical" | "high" | "medium" | "low";
  cisBenchmark?: string | null;
  iso27001Controls?: string | null;
  remediationGuidance: string;
  remediationEffort: string;
  evaluationLogic: string;
  failedInstances: number;
}

const SERVICE_ORDER = ["iam", "storage", "networking", "encryption", "logging"];

export function ChecksView() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/cspm/checks")
      .then((r) => r.json())
      .then((d) => setChecks(d.checks ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    if (!term) return checks;
    return checks.filter(
      (c) =>
        c.checkId.toLowerCase().includes(term) ||
        c.title.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term) ||
        (c.cisBenchmark ?? "").toLowerCase().includes(term) ||
        (c.iso27001Controls ?? "").toLowerCase().includes(term)
    );
  }, [checks, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, Check[]>();
    for (const c of filtered) {
      if (!map.has(c.service)) map.set(c.service, []);
      map.get(c.service)!.push(c);
    }
    return SERVICE_ORDER.filter((s) => map.has(s)).map((s) => ({ service: s, checks: map.get(s)! }));
  }, [filtered]);

  const totalWithFailures = checks.filter((c) => c.failedInstances > 0).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search checks, controls or CIS references..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-4 text-violet-600" />
                <strong className="text-foreground">{checks.length}</strong> documented checks
              </span>
              <span className="flex items-center gap-1.5">
                <AlertCircle className="size-4 text-rose-600" />
                <strong className="text-foreground">{totalWithFailures}</strong> with active failures
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
        <strong>Control mapping notice:</strong> References to CIS Benchmarks and ISO 27001:2022 are provided
        for internal alignment and traceability only. They do not constitute a formal certification or
        attestation of compliance.
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ service, checks: svcChecks }) => {
            const meta = SERVICE_META[service];
            const failed = svcChecks.reduce((s, c) => s + c.failedInstances, 0);
            return (
              <section key={service}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className={meta?.accent}>{svcChecks.length}</span>
                    <span>{meta?.label ?? service}</span>
                  </h3>
                  {failed > 0 && (
                    <Badge variant="outline" className="gap-1 border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300">
                      <AlertCircle className="size-3" /> {failed} active failures
                    </Badge>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {svcChecks.map((c) => (
                    <CheckCard key={c.id} check={c} />
                  ))}
                </div>
              </section>
            );
          })}
          {grouped.length === 0 && (
            <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
              No checks match your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckCard({ check }: { check: Check }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{check.checkId}</span>
              <SeverityBadge severity={check.severity} />
            </div>
            <CardTitle className="text-sm leading-snug">{check.title}</CardTitle>
          </div>
          {check.failedInstances > 0 ? (
            <Badge className="shrink-0 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
              {check.failedInstances} failing
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 gap-1 border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
              <ShieldCheck className="size-3" /> passing
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        <CardDescription className="leading-relaxed">{check.description}</CardDescription>

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evaluation logic</p>
          <p className="text-xs text-muted-foreground">{check.evaluationLogic}</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Remediation</p>
          <p className="text-xs leading-relaxed">{check.remediationGuidance}</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Effort:</span>
            <Badge variant="outline" className="capitalize text-xs">{check.remediationEffort}</Badge>
          </div>
        </div>

        {(check.cisBenchmark || check.iso27001Controls) && (
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Control mapping</p>
            {check.cisBenchmark && (
              <div className="flex items-start gap-2 text-xs">
                <Badge className="shrink-0 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900">CIS</Badge>
                <span className="text-muted-foreground">{check.cisBenchmark}</span>
              </div>
            )}
            {check.iso27001Controls && (
              <div className="flex items-start gap-2 text-xs">
                <Badge className="shrink-0 bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900">ISO</Badge>
                <span className="text-muted-foreground">{check.iso27001Controls}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
