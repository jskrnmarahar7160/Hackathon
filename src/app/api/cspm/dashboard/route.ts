// GET /api/cspm/dashboard
// Aggregated posture dashboard metrics for the most recent assessment.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SERVICE_LABELS, SEVERITY_WEIGHT } from "@/lib/cspm/checks";

export async function GET() {
  const account = await db.cloudAccount.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!account) {
    return NextResponse.json({ error: "No cloud account found" }, { status: 404 });
  }

  const lastAssessment = await db.assessment.findFirst({
    where: { accountId: account.id },
    orderBy: { startedAt: "desc" },
  });

  const findings = await db.finding.findMany({
    where: lastAssessment ? { assessmentId: lastAssessment.id } : {},
    include: { check: true, resource: true },
  });

  const resources = await db.resource.count({ where: { accountId: account.id } });
  const checks = await db.securityCheck.count();

  const critical = findings.filter((f) => f.result === "fail" && f.severity === "critical").length;
  const high = findings.filter((f) => f.result === "fail" && f.severity === "high").length;
  const medium = findings.filter((f) => f.result === "fail" && f.severity === "medium").length;
  const low = findings.filter((f) => f.result === "fail" && f.severity === "low").length;

  const openFindings = findings.filter((f) => f.status === "open" && f.result === "fail").length;
  const resolvedFindings = findings.filter((f) => f.status === "resolved").length;
  const failedTotal = findings.filter((f) => f.result === "fail").length;
  const passedTotal = findings.filter((f) => f.result === "pass").length;

  const applicable = findings.filter((f) => f.result === "pass" || f.result === "fail");
  const maxWeight = applicable.reduce((s, f) => s + (SEVERITY_WEIGHT[f.severity] ?? 0), 0);
  const lostWeight = applicable.filter((f) => f.result === "fail").reduce((s, f) => s + (SEVERITY_WEIGHT[f.severity] ?? 0), 0);
  const score = maxWeight === 0 ? 100 : Math.round(((maxWeight - lostWeight) / maxWeight) * 100);
  const passRate = applicable.length ? Math.round((passedTotal / applicable.length) * 100) : 100;

  const services = ["iam", "storage", "networking", "encryption", "logging"];
  const byService = services.map((svc) => {
    const svcFindings = findings.filter((f) => f.service === svc);
    const passed = svcFindings.filter((f) => f.result === "pass").length;
    const ffailed = svcFindings.filter((f) => f.result === "fail").length;
    const open = svcFindings.filter((f) => f.status === "open" && f.result === "fail").length;
    const smax = svcFindings.reduce((s, f) => s + (SEVERITY_WEIGHT[f.severity] ?? 0), 0);
    const slost = svcFindings.filter((f) => f.result === "fail").reduce((s, f) => s + (SEVERITY_WEIGHT[f.severity] ?? 0), 0);
    return {
      service: svc,
      serviceLabel: SERVICE_LABELS[svc] ?? svc,
      total: svcFindings.length,
      passed,
      failed: ffailed,
      open,
      critical: svcFindings.filter((f) => f.result === "fail" && f.severity === "critical").length,
      high: svcFindings.filter((f) => f.result === "fail" && f.severity === "high").length,
      medium: svcFindings.filter((f) => f.result === "fail" && f.severity === "medium").length,
      low: svcFindings.filter((f) => f.result === "fail" && f.severity === "low").length,
      score: smax === 0 ? 100 : Math.round(((smax - slost) / smax) * 100),
    };
  });

  const failingFindings = findings.filter((f) => f.result === "fail");
  const byStatus = {
    open: failingFindings.filter((f) => f.status === "open").length,
    in_progress: failingFindings.filter((f) => f.status === "in_progress").length,
    resolved: failingFindings.filter((f) => f.status === "resolved").length,
    suppressed: failingFindings.filter((f) => f.status === "suppressed").length,
  };

  const snapshots = await db.complianceSnapshot.findMany({
    where: { accountId: account.id },
    orderBy: { takenAt: "asc" },
    take: 12,
  });
  const trend = snapshots.map((s) => ({
    takenAt: s.takenAt.toISOString(),
    score: s.score,
    open: s.openCount,
    resolved: s.resolvedCount,
  }));

  return NextResponse.json({
    account: {
      id: account.id,
      provider: account.provider,
      accountId: account.accountId,
      displayName: account.displayName,
      region: account.region,
      lastSyncedAt: account.lastSyncedAt?.toISOString(),
    },
    totals: {
      checks,
      resources,
      findings: failedTotal,
      openFindings,
      resolvedFindings,
      critical,
      high,
      medium,
      low,
    },
    score,
    passRate,
    byService,
    byStatus,
    trend,
    // Top-5 findings by business-aware risk score — drives the "priority risks"
    // panel so remediation is ordered by real-world impact, not just severity.
    topRisk: findings
      .filter((f) => f.result === "fail" && f.status !== "resolved")
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5)
      .map((f) => ({
        id: f.id,
        checkId: f.check.checkId,
        title: f.check.title,
        severity: f.severity,
        riskScore: f.riskScore,
        resourceName: f.resource.name,
        resourceType: f.resource.resourceType,
        service: f.service,
        serviceLabel: SERVICE_LABELS[f.service] ?? f.service,
        resourceCriticality: f.resource.criticality,
        resourceInternetFacing: f.resource.internetFacing,
      })),
    lastAssessment: lastAssessment
      ? {
          id: lastAssessment.id,
          startedAt: lastAssessment.startedAt.toISOString(),
          completedAt: lastAssessment.completedAt?.toISOString(),
          totalChecks: lastAssessment.totalChecks,
          passed: lastAssessment.passed,
          failed: lastAssessment.failed,
        }
      : undefined,
  });
}
