// POST /api/cspm/assessments/run
// Re-runs the assessment engine against the latest read-only resource
// snapshot for the connected cloud account and persists a new assessment +
// findings (with computed risk scores) + compliance snapshot. Audit-logged.
// This is a re-evaluation only; no cloud resources are read or mutated at
// request time (the snapshot is seeded).

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runAssessment, computeScore, severityCounts } from "@/lib/cspm/engine";
import { computeRiskScore } from "@/lib/cspm/risk";
import { SAMPLE_SNAPSHOT } from "@/lib/cspm/snapshot";
import { audit, apiError, clientIp, rateLimit } from "@/lib/cspm/audit";
import type { Severity, Criticality } from "@/lib/cspm/risk";

export async function POST(request: NextRequest) {
  // Rate limit: max 6 manual runs per minute per IP.
  const ip = clientIp(request) ?? "anonymous";
  const rl = rateLimit(`assessment-run:${ip}`, 6, 60_000);
  if (!rl.allowed) {
    return apiError(429, "rate_limited", "Too many assessment runs. Please wait a minute.", {
      resetAt: rl.resetAt,
    });
  }

  const account = await db.cloudAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) return apiError(404, "no_account", "No cloud account connected");

  const startedAt = new Date();

  const dbResources = await db.resource.findMany({ where: { accountId: account.id } });
  const snapshot = SAMPLE_SNAPSHOT.filter((s) => dbResources.some((d) => d.id === s.id));

  const findings = runAssessment(snapshot);
  const durationMs = 380 + Math.floor(Math.random() * 120);
  const completedAt = new Date(startedAt.getTime() + durationMs);

  const passed = findings.filter((f) => f.result === "pass").length;
  const failed = findings.filter((f) => f.result === "fail").length;
  const errors = findings.filter((f) => f.result === "error").length;

  const assessment = await db.assessment.create({
    data: {
      accountId: account.id,
      status: "completed",
      trigger: "manual",
      totalChecks: findings.length,
      passed,
      failed,
      errors,
      durationMs,
      startedAt,
      completedAt,
    },
  });

  const checkRows = await db.securityCheck.findMany();
  const checkIdMap = new Map(checkRows.map((c) => [c.checkId, c.id]));

  for (const f of findings) {
    const snapResource = snapshot.find(
      (s) => s.resourceType === f.resource.resourceType && s.name === f.resource.name
    );
    if (!snapResource) continue;
    const criticality = (snapResource.criticality ?? "medium") as Criticality;
    const riskScore = computeRiskScore(f.severity as Severity, criticality, snapResource.internetFacing ?? false);
    await db.finding.create({
      data: {
        assessmentId: assessment.id,
        checkId: checkIdMap.get(f.checkId)!,
        resourceId: snapResource.id,
        service: f.resource.service,
        severity: f.severity,
        status: "open",
        result: f.result,
        evidence: JSON.stringify(f.evidence),
        riskScore,
        firstDetectedAt: startedAt,
        lastDetectedAt: completedAt,
      },
    });
  }

  const sev = severityCounts(findings.filter((f) => f.result !== "pass"));
  const score = computeScore(findings);
  await db.complianceSnapshot.create({
    data: {
      accountId: account.id,
      takenAt: completedAt,
      totalChecks: findings.length,
      passed,
      failed,
      critical: sev.critical,
      high: sev.high,
      medium: sev.medium,
      low: sev.low,
      openCount: failed,
      resolvedCount: 0,
      score,
    },
  });

  await audit({
    actor: "analyst@northwind.io",
    action: "assessment.run",
    targetType: "assessment",
    targetId: assessment.id,
    detail: `Manual assessment run produced ${failed} findings (score ${score}/100)`,
    metadata: { trigger: "manual", passed, failed, score, durationMs },
    ipAddress: ip,
  });

  return NextResponse.json({
    assessmentId: assessment.id,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    totalChecks: findings.length,
    passed,
    failed,
    score,
  });
}
