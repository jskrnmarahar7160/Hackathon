// GET /api/cspm/checks
// Returns the documented security checks library (with CIS / ISO mappings).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/cspm/checks";

export async function GET() {
  const checks = await db.securityCheck.findMany({
    orderBy: [{ service: "asc" }, { checkId: "asc" }],
  });

  // Attach the number of failed instances per check for the latest assessment
  const account = await db.cloudAccount.findFirst({ orderBy: { createdAt: "asc" } });
  const lastAssessment = account
    ? await db.assessment.findFirst({ where: { accountId: account.id }, orderBy: { startedAt: "desc" } })
    : null;
  const failCounts = new Map<string, number>();
  if (lastAssessment) {
    const fails = await db.finding.findMany({
      where: { assessmentId: lastAssessment.id, result: "fail" },
      include: { check: true },
    });
    for (const f of fails) {
      failCounts.set(f.check.checkId, (failCounts.get(f.check.checkId) ?? 0) + 1);
    }
  }

  const rows = checks.map((c) => ({
    id: c.id,
    checkId: c.checkId,
    service: c.service,
    serviceLabel: SERVICE_LABELS[c.service] ?? c.service,
    title: c.title,
    description: c.description,
    rationale: c.rationale,
    severity: c.severity,
    cisBenchmark: c.cisBenchmark,
    iso27001Controls: c.iso27001Controls,
    remediationGuidance: c.remediationGuidance,
    remediationEffort: c.remediationEffort,
    evaluationLogic: c.evaluationLogic,
    failedInstances: failCounts.get(c.checkId) ?? 0,
  }));

  return NextResponse.json({ checks: rows });
}
