// Report generation for the CSPM platform.
//
// Two report types are produced:
//   1. Evidence Pack  — a structured JSON document containing every finding
//      with its raw evidence, intended for auditors and downstream tooling.
//   2. Assessment Report — a human-readable executive + technical report that
//      summarizes posture, lists findings by severity, maps controls, and
//      documents the read-only scope and limitations.
//
// Both reports are generated server-side and returned as JSON. The frontend
// renders the assessment report to a printable view and offers downloads.

import { db } from "@/lib/db";
import { SERVICE_LABELS } from "./checks";
import { computeScore } from "./engine";
import type { Severity } from "./types";

export interface FindingDTO {
  id: string;
  checkId: string;
  service: string;
  serviceLabel: string;
  title: string;
  description: string;
  rationale: string;
  severity: Severity;
  status: string;
  result: string;
  evidence: {
    observed: string;
    expected: string;
    fields: Record<string, unknown>;
  };
  cisBenchmark?: string | null;
  iso27001Controls?: string | null;
  remediationGuidance: string;
  remediationEffort: string;
  resourceName: string;
  resourceType: string;
  resourceRegion?: string | null;
  resourceArn?: string | null;
  resourceConfig: Record<string, unknown>;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt?: string | null;
  assignee?: string | null;
  notes?: string | null;
}

/// Hydrate findings into a rich DTO with check + resource details.
export async function loadFindings(accountId: string): Promise<FindingDTO[]> {
  const findings = await db.finding.findMany({
    where: { assessment: { accountId } },
    include: { check: true, resource: true },
    orderBy: [
      { severity: "asc" },
      { status: "asc" },
      { lastDetectedAt: "desc" },
    ],
  });
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return findings
    .map((f) => ({
      id: f.id,
      checkId: f.check.checkId,
      service: f.service,
      serviceLabel: SERVICE_LABELS[f.service] ?? f.service,
      title: f.check.title,
      description: f.check.description,
      rationale: f.check.rationale,
      severity: f.severity as Severity,
      status: f.status,
      result: f.result,
      evidence: JSON.parse(f.evidence),
      cisBenchmark: f.check.cisBenchmark,
      iso27001Controls: f.check.iso27001Controls,
      remediationGuidance: f.check.remediationGuidance,
      remediationEffort: f.check.remediationEffort,
      resourceName: f.resource.name,
      resourceType: f.resource.resourceType,
      resourceRegion: f.resource.region,
      resourceArn: f.resource.arn,
      resourceConfig: JSON.parse(f.resource.config),
      firstDetectedAt: f.firstDetectedAt.toISOString(),
      lastDetectedAt: f.lastDetectedAt.toISOString(),
      resolvedAt: f.resolvedAt?.toISOString() ?? null,
      assignee: f.assignee,
      notes: f.notes,
    }))
    .sort((a, b) => order[a.severity] - order[b.severity]);
}

export interface EvidencePack {
  schemaVersion: string;
  generatedAt: string;
  account: {
    id: string;
    provider: string;
    accountId: string;
    displayName: string;
    region?: string | null;
    scanMode: string;
  };
  assessment: {
    id: string;
    startedAt: string;
    completedAt?: string | null;
    totalChecks: number;
    passed: number;
    failed: number;
    errors: number;
  };
  summary: {
    score: number;
    totalFindings: number;
    openFindings: number;
    bySeverity: Record<Severity, number>;
    byService: Record<string, number>;
  };
  controls: Array<{
    checkId: string;
    cisBenchmark?: string | null;
    iso27001Controls?: string | null;
    service: string;
    title: string;
    severity: Severity;
  }>;
  findings: FindingDTO[];
  notice: string;
}

export async function buildEvidencePack(accountId: string): Promise<EvidencePack> {
  const account = await db.cloudAccount.findFirst({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");

  const assessment = await db.assessment.findFirst({
    where: { accountId },
    orderBy: { startedAt: "desc" },
  });
  if (!assessment) throw new Error("No assessment found");

  const findings = await loadFindings(accountId);

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byService: Record<string, number> = {};
  let open = 0;
  for (const f of findings) {
    if (f.result === "fail") {
      bySeverity[f.severity]++;
      byService[f.service] = (byService[f.service] ?? 0) + 1;
      if (f.status === "open") open++;
    }
  }

  // Unique controls mapping
  const seen = new Set<string>();
  const controls: EvidencePack["controls"] = [];
  for (const f of findings) {
    if (seen.has(f.checkId)) continue;
    seen.add(f.checkId);
    controls.push({
      checkId: f.checkId,
      cisBenchmark: f.cisBenchmark ?? null,
      iso27001Controls: f.iso27001Controls ?? null,
      service: f.service,
      title: f.title,
      severity: f.severity,
    });
  }

  const score = computeScore(
    findings.map((f) => ({
      checkId: f.checkId,
      resource: {
        service: f.service as never,
        resourceType: f.resourceType,
        name: f.resourceName,
      },
      severity: f.severity,
      result: f.result as never,
      evidence: f.evidence as never,
    }))
  );

  return {
    schemaVersion: "cspm-evidence-1.0",
    generatedAt: new Date().toISOString(),
    account: {
      id: account.id,
      provider: account.provider,
      accountId: account.accountId,
      displayName: account.displayName,
      region: account.region,
      scanMode: account.scanMode,
    },
    assessment: {
      id: assessment.id,
      startedAt: assessment.startedAt.toISOString(),
      completedAt: assessment.completedAt?.toISOString() ?? null,
      totalChecks: assessment.totalChecks,
      passed: assessment.passed,
      failed: assessment.failed,
      errors: assessment.errors,
    },
    summary: {
      score,
      totalFindings: findings.filter((f) => f.result === "fail").length,
      openFindings: open,
      bySeverity,
      byService,
    },
    controls,
    findings,
    notice:
      "This evidence pack is generated from read-only configuration data. Control mappings to CIS Benchmarks and ISO 27001 are provided for internal alignment and traceability only and do not constitute a formal certification or attestation.",
  };
}

export interface AssessmentReport {
  schemaVersion: string;
  generatedAt: string;
  account: {
    provider: string;
    accountId: string;
    displayName: string;
    region?: string | null;
  };
  assessment: {
    id: string;
    startedAt: string;
    completedAt?: string | null;
    durationMs: number;
  };
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
    severity: Severity;
    cisBenchmark?: string | null;
    iso27001Controls?: string | null;
    failedInstances: number;
  }>;
  prioritizedRemediation: Array<{
    checkId: string;
    title: string;
    severity: Severity;
    resourceName: string;
    remediationGuidance: string;
    remediationEffort: string;
  }>;
  scopeAndLimitations: string[];
  disclaimer: string;
}

export async function buildAssessmentReport(accountId: string): Promise<AssessmentReport> {
  const account = await db.cloudAccount.findFirst({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");

  const assessment = await db.assessment.findFirst({
    where: { accountId },
    orderBy: { startedAt: "desc" },
  });
  if (!assessment) throw new Error("No assessment found");

  const findings = await loadFindings(accountId);
  const score = computeScore(
    findings.map((f) => ({
      checkId: f.checkId,
      resource: {
        service: f.service as never,
        resourceType: f.resourceType,
        name: f.resourceName,
      },
      severity: f.severity,
      result: f.result as never,
      evidence: f.evidence as never,
    }))
  );

  const passed = findings.filter((f) => f.result === "pass").length;
  const failed = findings.filter((f) => f.result === "fail").length;
  const passRate = findings.length ? Math.round((passed / findings.length) * 100) : 100;
  const criticalFindings = findings.filter((f) => f.result === "fail" && f.severity === "critical").length;
  const highFindings = findings.filter((f) => f.result === "fail" && f.severity === "high").length;

  // Posture by service
  const services = ["iam", "storage", "networking", "encryption", "logging"];
  const postureByService = services.map((svc) => {
    const svcFindings = findings.filter((f) => f.service === svc);
    const p = svcFindings.filter((f) => f.result === "pass").length;
    const f = svcFindings.filter((f) => f.result === "fail").length;
    const topFail = svcFindings.find((f) => f.result === "fail");
    return {
      service: svc,
      serviceLabel: SERVICE_LABELS[svc] ?? svc,
      total: svcFindings.length,
      passed: p,
      failed: f,
      score: svcFindings.length ? Math.round((p / svcFindings.length) * 100) : 100,
      topFinding: topFail ? `${topFail.title} on ${topFail.resourceName}` : undefined,
    };
  });

  // Control mapping (unique checks with failed instance counts)
  const seen = new Set<string>();
  const controlMapping: AssessmentReport["controlMapping"] = [];
  for (const f of findings) {
    if (f.result !== "fail") continue;
    if (seen.has(f.checkId)) {
      const existing = controlMapping.find((c) => c.checkId === f.checkId);
      if (existing) existing.failedInstances++;
      continue;
    }
    seen.add(f.checkId);
    controlMapping.push({
      checkId: f.checkId,
      service: f.service,
      title: f.title,
      severity: f.severity,
      cisBenchmark: f.cisBenchmark ?? null,
      iso27001Controls: f.iso27001Controls ?? null,
      failedInstances: 1,
    });
  }

  // Prioritized remediation (critical first, then high)
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const prioritizedRemediation = findings
    .filter((f) => f.result === "fail" && f.status !== "resolved")
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, 15)
    .map((f) => ({
      checkId: f.checkId,
      title: f.title,
      severity: f.severity,
      resourceName: f.resourceName,
      remediationGuidance: f.remediationGuidance,
      remediationEffort: f.remediationEffort,
    }));

  const headline =
    score >= 80
      ? "Cloud posture is healthy with minor gaps to remediate."
      : score >= 60
      ? "Cloud posture has notable gaps requiring prioritized remediation."
      : "Cloud posture is at risk with critical findings requiring immediate attention.";

  const narrative = `The latest assessment evaluated ${findings.length} control instances across ${services.length} services. ${passed} controls passed and ${failed} failed, producing a weighted compliance score of ${score}/100. ${criticalFindings} critical and ${highFindings} high-severity findings are currently open and should be prioritized. Trend data shows remediation progress over the last 35 days.`;

  const scopeAndLimitations = [
    "The platform operates in READ-ONLY mode. It reads authorized configuration data and never mutates cloud resources.",
    "Assessments are point-in-time snapshots. Configuration drift between scans is not detected until the next assessment.",
    "Control mappings to CIS Benchmarks and ISO 27001:2022 are provided for internal alignment and traceability only and do not constitute formal certification.",
    "The checks library covers IAM, Storage, Networking, Encryption and Logging. Services outside this scope are not assessed.",
    "Findings rely on the accuracy of the configuration data returned by the cloud provider's read APIs.",
    "Remediation status is tracked within the platform; actual remediation must be performed by authorized operators in the cloud account.",
  ];

  const disclaimer =
    "This report is generated by the CSPM prototype for internal use. It is not a substitute for a formal audit or compliance attestation.";

  return {
    schemaVersion: "cspm-report-1.0",
    generatedAt: new Date().toISOString(),
    account: {
      provider: account.provider,
      accountId: account.accountId,
      displayName: account.displayName,
      region: account.region,
    },
    assessment: {
      id: assessment.id,
      startedAt: assessment.startedAt.toISOString(),
      completedAt: assessment.completedAt?.toISOString() ?? null,
      durationMs: assessment.durationMs,
    },
    executiveSummary: {
      score,
      passRate,
      totalChecks: findings.length,
      passed,
      failed,
      criticalFindings,
      highFindings,
      headline,
      narrative,
    },
    postureByService,
    controlMapping,
    prioritizedRemediation,
    scopeAndLimitations,
    disclaimer,
  };
}
