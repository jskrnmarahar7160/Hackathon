// GET /api/cspm/resources
// Returns the cloud resource inventory grouped by service.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/cspm/checks";

export async function GET() {
  const account = await db.cloudAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) return NextResponse.json({ error: "No account" }, { status: 404 });

  const resources = await db.resource.findMany({
    where: { accountId: account.id },
    orderBy: [{ service: "asc" }, { name: "asc" }],
  });

  // Count open findings per resource for the latest assessment
  const lastAssessment = await db.assessment.findFirst({
    where: { accountId: account.id },
    orderBy: { startedAt: "desc" },
  });
  const findings = lastAssessment
    ? await db.finding.findMany({
        where: { assessmentId: lastAssessment.id, result: "fail" },
        include: { check: true },
      })
    : [];
  const failByResource = new Map<string, { critical: number; high: number; medium: number; low: number; total: number }>();
  for (const f of findings) {
    const cur = failByResource.get(f.resourceId) ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    cur.total++;
    cur[f.severity as "critical" | "high" | "medium" | "low"]++;
    failByResource.set(f.resourceId, cur);
  }

  const rows = resources.map((r) => ({
    id: r.id,
    service: r.service,
    serviceLabel: SERVICE_LABELS[r.service] ?? r.service,
    resourceType: r.resourceType,
    name: r.name,
    region: r.region,
    arn: r.arn,
    config: JSON.parse(r.config),
    lastSeenAt: r.lastSeenAt.toISOString(),
    findings: failByResource.get(r.id) ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
  }));

  const services = ["iam", "storage", "networking", "encryption", "logging"];
  const byService = services.map((svc) => ({
    service: svc,
    serviceLabel: SERVICE_LABELS[svc] ?? svc,
    count: rows.filter((r) => r.service === svc).length,
    openFindings: rows
      .filter((r) => r.service === svc)
      .reduce((s, r) => s + r.findings.total, 0),
  }));

  return NextResponse.json({ resources: rows, byService });
}
