"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Search,
  Filter,
  Download,
  Loader2,
  CheckCircle2,
  Circle,
  Clock3,
  EyeOff,
  ExternalLink,
  FileJson,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SeverityBadge, StatusBadge, ResultBadge } from "../badges";
import { SERVICE_META, formatDate, type Severity, type FindingStatus } from "../lib";
import { MarkdownPlaybook } from "../markdown";
import { toast } from "sonner";

interface Finding {
  id: string;
  checkId: string;
  service: string;
  serviceLabel: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  result: string;
  riskScore?: number;
  resourceName: string;
  resourceType: string;
  resourceRegion?: string | null;
  resourceArn?: string | null;
  resourceCriticality?: string;
  resourceInternetFacing?: boolean;
  cisBenchmark?: string | null;
  iso27001Controls?: string | null;
  remediationGuidance: string;
  remediationEffort: string;
  rationale: string;
  description: string;
  evidence: { observed: string; expected: string; fields: Record<string, unknown> };
  resourceConfig: Record<string, unknown>;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt?: string | null;
  assignee?: string | null;
  notes?: string | null;
}

export function FindingsView() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [result, setResult] = useState<string>("fail");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Finding | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (service !== "all") params.set("service", service);
    if (severity !== "all") params.set("severity", severity);
    if (status !== "all") params.set("status", status);
    if (result !== "all") params.set("result", result);
    if (q) params.set("q", q);
    fetch(`/api/cspm/findings?${params}`)
      .then((r) => r.json())
      .then((d) => setFindings(d.findings ?? []))
      .finally(() => setLoading(false));
  }, [service, severity, status, result, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const counts = useMemo(() => {
    return {
      total: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
    };
  }, [findings]);

  async function updateStatus(id: string, newStatus: FindingStatus, note?: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/cspm/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note }),
      });
      if (!res.ok) throw new Error("Update failed");
      const updated = await res.json();
      setFindings((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: updated.status, resolvedAt: updated.resolvedAt, notes: updated.notes }
            : f
        )
      );
      setActive((prev) =>
        prev && prev.id === id
          ? { ...prev, status: updated.status, resolvedAt: updated.resolvedAt, notes: updated.notes }
          : prev
      );
      toast.success(`Finding marked as ${newStatus.replace("_", " ")}`);
    } catch {
      toast.error("Could not update finding status");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by check, title or resource..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterSelect label="Service" value={service} onChange={setService} options={[
                { value: "iam", label: "Identity & Access" },
                { value: "storage", label: "Storage" },
                { value: "networking", label: "Networking" },
                { value: "encryption", label: "Encryption" },
                { value: "logging", label: "Logging & Monitoring" },
              ]} />
              <FilterSelect label="Severity" value={severity} onChange={setSeverity} options={[
                { value: "critical", label: "Critical" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]} />
              <FilterSelect label="Status" value={status} onChange={setStatus} options={[
                { value: "open", label: "Open" },
                { value: "in_progress", label: "In Progress" },
                { value: "resolved", label: "Resolved" },
                { value: "suppressed", label: "Suppressed" },
              ]} />
              <FilterSelect label="Result" value={result} onChange={setResult} options={[
                { value: "fail", label: "Failed" },
                { value: "pass", label: "Passed" },
                { value: "all", label: "All" },
              ]} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Filter className="size-3.5" />
            <span>
              Showing <strong className="text-foreground">{counts.total}</strong> findings
            </span>
            <span className="text-rose-500">·</span>
            <span>{counts.critical} critical</span>
            <span className="text-orange-500">·</span>
            <span>{counts.high} high</span>
            <span className="text-amber-500">·</span>
            <span>{counts.medium} medium</span>
            <span className="text-slate-400">·</span>
            <span>{counts.low} low</span>
          </div>
        </CardContent>
      </Card>

      {/* Findings table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Check</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Service</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Detected</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={7} className="px-4 py-4"><Skeleton className="h-8" /></td>
                    </tr>
                  ))
                ) : findings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No findings match the current filters.
                    </td>
                  </tr>
                ) : (
                  findings.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setActive(f)}
                      className="group cursor-pointer border-b transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{f.checkId}</span>
                          <span className="font-medium leading-tight group-hover:text-foreground">{f.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><SeverityBadge severity={f.severity} /></td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium leading-tight">{f.resourceName}</span>
                          <span className="font-mono text-xs text-muted-foreground">{f.resourceType}</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Badge variant="outline" className="font-normal">{f.serviceLabel}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                        {formatDate(f.firstDetectedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ResultBadge result={f.result} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <FindingDetail
        key={active?.id ?? "none"}
        finding={active}
        open={!!active}
        onOpenChange={(o) => !o && setActive(null)}
        updating={updating}
        onUpdate={updateStatus}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FindingDetail({
  finding,
  open,
  onOpenChange,
  updating,
  onUpdate,
}: {
  finding: Finding | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  updating: boolean;
  onUpdate: (id: string, status: FindingStatus, note?: string) => void;
}) {
  const [note, setNote] = useState(finding?.notes ?? "");
  const [aiPlaybook, setAiPlaybook] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function generateRemediation() {
    if (!finding) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/cspm/findings/${finding.id}/remediation`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Failed");
      setAiPlaybook(data.playbook);
      toast.success("AI remediation playbook generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate playbook");
    } finally {
      setAiLoading(false);
    }
  }

  if (!finding) return null;

  const statusActions: { status: FindingStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { status: "open", label: "Open", icon: Circle },
    { status: "in_progress", label: "In Progress", icon: Clock3 },
    { status: "resolved", label: "Resolve", icon: CheckCircle2 },
    { status: "suppressed", label: "Suppress", icon: EyeOff },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono">{finding.checkId}</Badge>
            <SeverityBadge severity={finding.severity} />
            <StatusBadge status={finding.status} />
            {typeof finding.riskScore === "number" && (
              <Badge variant="outline" className="gap-1">
                <span className="text-muted-foreground">Risk</span>
                <span className="font-semibold tabular-nums">{finding.riskScore}</span>
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg">{finding.title}</SheetTitle>
          <SheetDescription className="leading-relaxed">{finding.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5 px-1 pb-6">
          {/* Resource */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Affected Resource</h4>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{finding.resourceName}</span>
                <Badge variant="outline" className="font-mono text-xs">{finding.resourceType}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Region: <span className="font-mono text-foreground">{finding.resourceRegion ?? "—"}</span></span>
                <span>Service: <span className="text-foreground">{finding.serviceLabel}</span></span>
                {finding.resourceCriticality && (
                  <span>Criticality: <span className="text-foreground capitalize">{finding.resourceCriticality}</span></span>
                )}
                {finding.resourceInternetFacing && (
                  <span className="text-rose-600 dark:text-rose-400">Internet-facing: yes</span>
                )}
              </div>
              {finding.resourceArn && (
                <div className="mt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ExternalLink className="size-3" /> ARN: <span className="font-mono text-foreground">{finding.resourceArn}</span>
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Evidence */}
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileJson className="size-3.5" /> Evidence
            </h4>
            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Expected</p>
                <p className="text-sm">{finding.evidence.expected}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Observed</p>
                <p className="text-sm">{finding.evidence.observed}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Raw configuration</p>
                <pre className="max-h-48 overflow-auto rounded bg-muted/60 p-2 font-mono text-xs leading-relaxed">
                  {JSON.stringify(finding.evidence.fields ?? finding.resourceConfig, null, 2)}
                </pre>
              </div>
            </div>
          </section>

          {/* Rationale */}
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldQuestion className="size-3.5" /> Why this matters
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{finding.rationale}</p>
          </section>

          {/* Control mapping */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Control Mapping</h4>
            <div className="space-y-2">
              {finding.cisBenchmark && (
                <div className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900">CIS</Badge>
                    <span className="text-xs text-muted-foreground">CIS Benchmark reference</span>
                  </div>
                  <p className="mt-1.5 text-sm">{finding.cisBenchmark}</p>
                </div>
              )}
              {finding.iso27001Controls && (
                <div className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900">ISO 27001</Badge>
                    <span className="text-xs text-muted-foreground">ISO 27001:2022 controls</span>
                  </div>
                  <p className="mt-1.5 text-sm">{finding.iso27001Controls}</p>
                </div>
              )}
              {!finding.cisBenchmark && !finding.iso27001Controls && (
                <p className="text-sm text-muted-foreground">No external control mapping recorded for this check.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Mappings are for internal alignment and traceability only and do not constitute certification.
              </p>
            </div>
          </section>

          {/* Remediation */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remediation Guidance</h4>
            <div className="rounded-lg border p-3">
              <p className="text-sm leading-relaxed">{finding.remediationGuidance}</p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Effort:</span>
                <Badge variant="outline" className="capitalize">{finding.remediationEffort}</Badge>
              </div>
            </div>
          </section>

          {/* AI Remediation Assistant */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3.5 text-violet-600" /> AI Remediation Assistant
              </h4>
              {!aiPlaybook && (
                <Button size="sm" variant="default" onClick={generateRemediation} disabled={aiLoading} className="gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
                  {aiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {aiLoading ? "Generating…" : "Generate playbook"}
                </Button>
              )}
            </div>
            {aiPlaybook ? (
              <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900 dark:bg-violet-950/20">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                    <Sparkles className="size-3.5" /> Contextual playbook grounded in this finding's evidence
                  </span>
                  <Button size="sm" variant="ghost" onClick={generateRemediation} disabled={aiLoading} className="h-7 gap-1 text-xs">
                    {aiLoading ? <Loader2 className="size-3 animate-spin" /> : null}
                    Regenerate
                  </Button>
                </div>
                <article>
                  <MarkdownPlaybook content={aiPlaybook} />
                </article>
                <p className="border-t border-violet-200 pt-2 text-[10px] text-muted-foreground dark:border-violet-900">
                  Generated by the LLM assistant from the finding's evidence and resource config. Review before applying.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Generate a step-by-step, contextual remediation playbook with CLI commands, console steps,
                verification and rollback notes — grounded in this finding's evidence and resource config.
              </div>
            )}
          </section>

          {/* Timeline */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h4>
            <div className="space-y-2 text-sm">
              <TimelineItem label="First detected" value={formatDate(finding.firstDetectedAt)} />
              <TimelineItem label="Last detected" value={formatDate(finding.lastDetectedAt)} />
              {finding.resolvedAt && <TimelineItem label="Resolved" value={formatDate(finding.resolvedAt)} highlight />}
            </div>
          </section>

          {/* Status management */}
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manage Remediation</h4>
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Tracking only — updating status does not modify any cloud resource.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {statusActions.map(({ status, label, icon: Icon }) => {
                  const isActive = finding.status === status;
                  return (
                    <Button
                      key={status}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      disabled={updating || isActive}
                      onClick={() => onUpdate(finding.id, status, note || undefined)}
                      className="gap-1.5"
                    >
                      {updating ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
                      {label}
                    </Button>
                  );
                })}
              </div>
              <Input
                placeholder="Add a remediation note (optional)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TimelineItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium"}>{value}</span>
    </div>
  );
}
