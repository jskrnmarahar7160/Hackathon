"use client";

import { useEffect, useState } from "react";
import { Crosshair, ArrowRight, Globe, AlertOctagon, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "../badges";
import { ATTACK_PATH_CATEGORY_META } from "@/lib/cspm/risk";

interface AttackStep {
  checkId: string;
  service: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  resourceName: string;
  resourceType: string;
}

interface AttackPath {
  id: string;
  name: string;
  scenario: string;
  impact: string;
  blastRadius: number;
  category: "data_exfiltration" | "initial_access" | "privilege_escalation" | "lateral_movement" | "audit_evasion";
  steps: AttackStep[];
}

function blastColor(b: number): string {
  if (b >= 80) return "#e11d48";
  if (b >= 50) return "#f97316";
  return "#d97706";
}

export function AttackPathsView() {
  const [paths, setPaths] = useState<AttackPath[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cspm/attack-paths")
      .then((r) => r.json())
      .then((d) => setPaths(d.attackPaths ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Crosshair className="size-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Attack-path analysis</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Instead of treating findings in isolation, the engine chains related failures
                into scenarios showing how individual misconfigurations combine into a larger
                real-world risk — prioritising remediation by blast radius, not just severity.
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <Metric label="Active paths" value={paths.length} />
                <Metric label="Highest blast radius" value={`${paths[0]?.blastRadius ?? 0}%`} color={blastColor(paths[0]?.blastRadius ?? 0)} />
                <Metric label="Categories" value={new Set(paths.map((p) => p.category)).size} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {paths.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No attack paths detected in the latest assessment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {paths.map((path) => {
            const meta = ATTACK_PATH_CATEGORY_META[path.category];
            return (
              <Card key={path.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-white"
                          style={{ background: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{path.id}</span>
                      </div>
                      <CardTitle className="mt-2 text-base">{path.name}</CardTitle>
                      <CardDescription className="mt-1 leading-relaxed">{path.scenario}</CardDescription>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-3xl font-semibold tabular-nums" style={{ color: blastColor(path.blastRadius) }}>
                        {path.blastRadius}%
                      </div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">blast radius</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Blast radius bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${path.blastRadius}%`, background: blastColor(path.blastRadius) }}
                    />
                  </div>

                  {/* Impact */}
                  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/30">
                    <AlertOctagon className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <p className="text-rose-800 dark:text-rose-200">{path.impact}</p>
                  </div>

                  {/* Steps */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Attack chain — {path.steps.length} steps
                    </p>
                    <div className="space-y-2">
                      {path.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                            {i + 1}
                          </div>
                          <div className="flex-1 rounded-lg border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <SeverityBadge severity={step.severity} />
                              <span className="font-mono text-xs text-muted-foreground">{step.checkId}</span>
                              <span className="text-sm font-medium">{step.title}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <Globe className="size-3" />
                              <span className="font-mono">{step.resourceType}</span>
                              <span>·</span>
                              <span>{step.resourceName}</span>
                            </div>
                          </div>
                          {i < path.steps.length - 1 && (
                            <ArrowRight className="mt-3 hidden size-4 shrink-0 text-muted-foreground/40 sm:block" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}: </span>
      <span className="font-semibold tabular-nums" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}
