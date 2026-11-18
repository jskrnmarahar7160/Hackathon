// GET /api/cspm/attack-paths
// Chains related failing findings into attack-path scenarios showing how
// individual misconfigurations combine into larger real-world risk.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildAttackPaths } from "@/lib/cspm/risk";

export async function GET() {
  const account = await db.cloudAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) return NextResponse.json({ error: "No account" }, { status: 404 });

  const lastAssessment = await db.assessment.findFirst({
    where: { accountId: account.id },
    orderBy: { startedAt: "desc" },
  });

  const findings = lastAssessment
    ? await db.finding.findMany({
        where: { assessmentId: lastAssessment.id, result: "fail" },
        include: { check: true, resource: true },
      })
    : [];

  const inputs = findings.map((f) => ({
    checkId: f.check.checkId,
    service: f.service,
    title: f.check.title,
    severity: f.severity as "critical" | "high" | "medium" | "low",
    resourceName: f.resource.name,
    resourceType: f.resource.resourceType,
  }));

  const paths = buildAttackPaths(inputs);

  return NextResponse.json({
    assessmentId: lastAssessment?.id ?? null,
    attackPaths: paths,
    totalPaths: paths.length,
    highestBlastRadius: paths[0]?.blastRadius ?? 0,
  });
}
