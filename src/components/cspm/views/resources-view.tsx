"use client";

import { useEffect, useState } from "react";
import { Boxes, MapPin, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SERVICE_META, formatDate } from "../lib";

interface ResourceRow {
  id: string;
  service: string;
  serviceLabel: string;
  resourceType: string;
  name: string;
  region?: string | null;
  arn?: string | null;
  config: Record<string, unknown>;
  lastSeenAt: string;
  findings: { critical: number; high: number; medium: number; low: number; total: number };
}

const SERVICE_ORDER = ["iam", "storage", "networking", "encryption", "logging"];

export function ResourcesView() {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [byService, setByService] = useState<Array<{ service: string; serviceLabel: string; count: number; openFindings: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/cspm/resources")
      .then((r) => r.json())
      .then((d) => {
        setResources(d.resources ?? []);
        setByService(d.byService ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = resources.filter((r) => {
    if (!q) return true;
    const term = q.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      r.resourceType.toLowerCase().includes(term) ||
      (r.arn ?? "").toLowerCase().includes(term)
    );
  });

  const grouped = SERVICE_ORDER.map((s) => ({
    service: s,
    items: filtered.filter((r) => r.service === s),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search resources by name, type or ARN..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {byService.map((s) => (
                <Badge key={s.service} variant="outline" className="gap-1.5">
                  <Boxes className="size-3 text-violet-600" />
                  {s.serviceLabel}: {s.count}
                  {s.openFindings > 0 && (
                    <span className="text-rose-600">· {s.openFindings} findings</span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ service, items }) => {
            const meta = SERVICE_META[service];
            const openTotal = items.reduce((s, r) => s + r.findings.total, 0);
            return (
              <section key={service}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <span className={meta?.accent}>{meta?.label ?? service}</span>
                    <span className="text-muted-foreground/60">·</span>
                    <span>{items.length} resources</span>
                  </h3>
                  {openTotal > 0 && (
                    <Badge variant="outline" className="border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300">
                      {openTotal} findings
                    </Badge>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((r) => (
                    <ResourceCard key={r.id} resource={r} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResourceCard({ resource }: { resource: ResourceRow }) {
  const f = resource.findings;
  const sevParts = [
    { n: f.critical, cls: "bg-rose-500" },
    { n: f.high, cls: "bg-orange-500" },
    { n: f.medium, cls: "bg-amber-500" },
    { n: f.low, cls: "bg-slate-400" },
  ];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{resource.name}</CardTitle>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{resource.resourceType}</p>
          </div>
          {f.total > 0 ? (
            <Badge className="shrink-0 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
              {f.total} findings
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
              Clean
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3" />
            <span>{resource.region ?? "global"}</span>
            <span className="ml-auto">{formatDate(resource.lastSeenAt)}</span>
          </div>
        </div>

        {/* Severity strip */}
        <div className="flex items-center gap-1">
          {sevParts.map((p, i) => (
            <div key={i} className="flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${p.cls}`} style={{ width: `${Math.min((p.n / Math.max(f.total, 1)) * 100, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Config preview */}
        <div className="rounded bg-muted/50 p-2">
          <pre className="max-h-24 overflow-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
            {JSON.stringify(resource.config, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
