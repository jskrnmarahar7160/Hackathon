"use client";

import {
  ShieldCheck,
  Eye,
  Database,
  Server,
  ScanLine,
  FileCheck2,
  Lock,
  Layers,
  AlertTriangle,
  ArrowRight,
  Cloud,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const LAYERS = [
  {
    icon: Cloud,
    title: "Authorized Cloud Account",
    accent: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    desc: "The connected cloud account (AWS / GCP / Azure). The platform holds read-only credentials scoped to configuration-reading APIs only.",
    bullets: [
      "IAM:Get*, S3:Get*, EC2:Describe*, KMS:Describe*, CloudTrail:Describe*",
      "No write or delete permissions granted to the platform",
    ],
  },
  {
    icon: ScanLine,
    title: "Read-Only Snapshot Collector",
    accent: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    desc: "Periodically (and on demand) pulls authorized configuration data into an immutable point-in-time snapshot stored in the platform database.",
    bullets: [
      "Point-in-time capture of resource configurations",
      "Never mutates cloud state — read APIs only",
      "Stored as JSON config blobs per resource",
    ],
  },
  {
    icon: FileCheck2,
    title: "Assessment Engine",
    accent: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    desc: "Evaluates the snapshot against the documented checks library, producing findings with structured evidence, severity, and control mappings.",
    bullets: [
      "Deterministic, pure functions per check",
      "Evidence captured as observed vs. expected",
      "Maps findings to CIS Benchmark & ISO 27001 controls",
    ],
  },
  {
    icon: Database,
    title: "Posture Database",
    accent: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    desc: "Persists accounts, resources, checks, findings, remediation events, and compliance trend snapshots for longitudinal tracking.",
    bullets: [
      "Findings keep first/last-detected timestamps",
      "Remediation events append an audit trail",
      "Compliance snapshots power the trend chart",
    ],
  },
  {
    icon: Layers,
    title: "Dashboard & Reporting",
    accent: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    desc: "Read-only presentation layer surfacing findings, severity, remediation status, compliance trends, and downloadable reports.",
    bullets: [
      "Findings table with filters and detail drawer",
      "Evidence pack + assessment report downloads",
      "Status tracking is local; cloud is never mutated",
    ],
  },
];

const LIMITATIONS = [
  {
    title: "Point-in-time, not real-time",
    desc: "Assessments reflect the snapshot captured during the last authorized read sync. Configuration drift between scans is not detected until the next run.",
  },
  {
    title: "Scope limited to five services",
    desc: "The checks library covers IAM, Storage, Networking, Encryption and Logging. Services outside this scope are not assessed.",
  },
  {
    title: "Mapping is not certification",
    desc: "CIS Benchmark and ISO 27001 references support internal alignment and traceability. They do not constitute a formal audit or compliance attestation.",
  },
  {
    title: "Remediation is tracked, not executed",
    desc: "The platform records remediation status changes for reporting. Actual remediation must be performed by authorized operators in the cloud account.",
  },
  {
    title: "Read-only credentials enforced",
    desc: "The platform operates with credentials scoped to read-only APIs. Even if compromised, the platform cannot modify cloud resources.",
  },
  {
    title: "Evidence accuracy depends on the source",
    desc: "Findings rely on the accuracy of the configuration data returned by the cloud provider's read APIs. Misreported configuration cannot be detected.",
  },
];

const PRINCIPLES = [
  { icon: Eye, title: "Read-only by design", desc: "No write permissions; the platform cannot mutate cloud state." },
  { icon: Lock, title: "Least-privilege credentials", desc: "Scoped to configuration-reading APIs only." },
  { icon: FileCheck2, title: "Documented checks", desc: "Every check has rationale, severity, and control mapping." },
  { icon: ShieldCheck, title: "Evidence-backed findings", desc: "Observed vs. expected evidence for every failure." },
];

export function ArchitectureView() {
  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="overflow-hidden">
        <CardContent className="relative p-6">
          <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-50 to-transparent dark:from-emerald-950/20" />
          <div className="relative">
            <Badge className="mb-2 gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
              <ShieldCheck className="size-3" /> Read-only design
            </Badge>
            <h2 className="text-xl font-semibold">Architecture &amp; Design</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              The CSPM platform evaluates authorized, read-only cloud configuration data against a
              documented set of security checks, maps findings to CIS Benchmarks and ISO 27001
              controls, and tracks remediation over time — without ever mutating cloud resources.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Principles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRINCIPLES.map((p) => (
          <Card key={p.title}>
            <CardContent className="flex flex-col items-start gap-2 p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <p.icon className="size-4.5" />
              </div>
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Architecture layers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="size-4 text-violet-600" /> System Architecture
          </CardTitle>
          <CardDescription>End-to-end data flow from authorized cloud account to dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {LAYERS.map((layer, i) => (
              <div key={layer.title}>
                <div className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start ${layer.bg}`}>
                  <div className="flex items-center gap-3 sm:w-64 sm:shrink-0">
                    <div className={`flex size-9 items-center justify-center rounded-lg bg-background ${layer.accent}`}>
                      <layer.icon className="size-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Layer {i + 1}
                      </p>
                      <p className="text-sm font-semibold">{layer.title}</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{layer.desc}</p>
                    <ul className="mt-2 space-y-1">
                      {layer.bullets.map((b, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className={`mt-1 size-1 shrink-0 rounded-full ${layer.accent.replace("text-", "bg-")}`} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {i < LAYERS.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowRight className="size-4 rotate-90 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data model */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-4 text-amber-600" /> Data Model
          </CardTitle>
          <CardDescription>Entities persisted by the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "CloudAccount", desc: "Connected cloud account with read-only scan mode." },
              { name: "Resource", desc: "Cloud resource captured in a read-only snapshot, with raw config JSON." },
              { name: "SecurityCheck", desc: "Documented check with rationale, severity, control mappings and remediation guidance." },
              { name: "Assessment", desc: "A run of the engine against a snapshot, with pass/fail counts." },
              { name: "Finding", desc: "A check-resource pair with result, evidence, severity, status and timestamps." },
              { name: "Remediation", desc: "Append-only audit trail of status changes and notes per finding." },
              { name: "ComplianceSnapshot", desc: "Point-in-time compliance score and severity counts for trend tracking." },
            ].map((e) => (
              <div key={e.name} className="rounded-lg border p-3">
                <p className="font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">{e.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{e.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Limitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-600" /> Scope &amp; Limitations
          </CardTitle>
          <CardDescription>What the platform does and does not do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {LIMITATIONS.map((l) => (
              <div key={l.title} className="rounded-lg border p-3">
                <p className="flex items-start gap-2 text-sm font-medium">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-500" />
                  {l.title}
                </p>
                <p className="mt-1.5 pl-3.5 text-xs text-muted-foreground">{l.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <strong>Disclaimer:</strong> This platform is a CSPM prototype intended for internal use.
            Control mappings to CIS Benchmarks and ISO 27001:2022 are provided for traceability only
            and do not constitute a formal certification or compliance attestation.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
