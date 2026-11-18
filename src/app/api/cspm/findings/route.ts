// GET /api/cspm/findings
// Lists findings for the latest assessment with optional filters:
//   ?service=iam&severity=critical&status=open&result=fail&q=keyword

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/cspm/checks";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const service = sp.get("service") || undefined;
  const severity = sp.get("severity") || undefined;
  const status = sp.get("status") || undefined;
  const result = sp.get("result") || undefined;
  const q = sp.get("q")?.toLowerCase() || undefined;

  const account = await db.cloudAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) return NextResponse.json({ error: "No account" }, { status: 404 });

  const lastAssessment = await db.assessment.findFirst({
    where: { accountId: account.id },
    orderBy: { startedAt: "desc" },
  });

  const findings = await db.finding.findMany({
    where: lastAssessment ? { assessmentId: lastAssessment.id } : {},
    include: { check: true, resource: true },
  });

  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  let rows = findings.map((f) => ({
    id: f.id,
    checkId: f.check.checkId,
    service: f.service,
    serviceLabel: SERVICE_LABELS[f.service] ?? f.service,
    title: f.check.title,
    severity: f.severity,
    status: f.status,
    result: f.result,
    riskScore: f.riskScore,
    resourceName: f.resource.name,
    resourceType: f.resource.resourceType,
    resourceRegion: f.resource.region,
    resourceArn: f.resource.arn,
    resourceCriticality: f.resource.criticality,
    resourceInternetFacing: f.resource.internetFacing,
    cisBenchmark: f.check.cisBenchmark,
    iso27001Controls: f.check.iso27001Controls,
    remediationGuidance: f.check.remediationGuidance,
    remediationEffort: f.check.remediationEffort,
    rationale: f.check.rationale,
    description: f.check.description,
    evidence: JSON.parse(f.evidence),
    resourceConfig: JSON.parse(f.resource.config),
    firstDetectedAt: f.firstDetectedAt.toISOString(),
    lastDetectedAt: f.lastDetectedAt.toISOString(),
    resolvedAt: f.resolvedAt?.toISOString() ?? null,
    assignee: f.assignee,
    notes: f.notes,
  }));

  if (service) rows = rows.filter((r) => r.service === service);
  if (severity) rows = rows.filter((r) => r.severity === severity);
  if (status) rows = rows.filter((r) => r.status === status);
  if (result) rows = rows.filter((r) => r.result === result);
  if (q) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.checkId.toLowerCase().includes(q) ||
        r.resourceName.toLowerCase().includes(q) ||
        r.resourceType.toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) => {
    const s = order[a.severity] - order[b.severity];
    if (s !== 0) return s;
    if (a.status !== b.status) {
      const so: Record<string, number> = { open: 0, in_progress: 1, suppressed: 2, resolved: 3 };
      return (so[a.status] ?? 9) - (so[b.status] ?? 9);
    }
    return a.checkId.localeCompare(b.checkId);
  });

  return NextResponse.json({ assessment: lastAssessment ? { id: lastAssessment.id, startedAt: lastAssessment.startedAt.toISOString() } : null, findings: rows });
}
