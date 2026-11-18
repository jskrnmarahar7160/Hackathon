// GET /api/cspm/findings/csv
// Streams findings as CSV for import into spreadsheets / ticketing systems.

import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/cspm/checks";

function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  // escape per RFC 4180
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const account = await db.cloudAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) {
    return new Response("No account", { status: 404 });
  }
  const lastAssessment = await db.assessment.findFirst({
    where: { accountId: account.id },
    orderBy: { startedAt: "desc" },
  });
  const findings = lastAssessment
    ? await db.finding.findMany({
        where: { assessmentId: lastAssessment.id },
        include: { check: true, resource: true },
        orderBy: [{ riskScore: "desc" }, { severity: "asc" }],
      })
    : [];

  const header = [
    "checkId", "title", "service", "severity", "status", "result",
    "riskScore", "resourceName", "resourceType", "region", "arn",
    "cisBenchmark", "iso27001Controls", "remediationGuidance", "remediationEffort",
    "firstDetectedAt", "lastDetectedAt", "resolvedAt",
  ];

  const rows = findings.map((f) => [
    f.check.checkId, f.check.title, SERVICE_LABELS[f.service] ?? f.service,
    f.severity, f.status, f.result, f.riskScore,
    f.resource.name, f.resource.resourceType, f.resource.region ?? "", f.resource.arn ?? "",
    f.check.cisBenchmark ?? "", f.check.iso27001Controls ?? "",
    f.check.remediationGuidance, f.check.remediationEffort,
    f.firstDetectedAt.toISOString(), f.lastDetectedAt.toISOString(),
    f.resolvedAt?.toISOString() ?? "",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvField).join(",")).join("\n");

  const filename = `cspm-findings-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
