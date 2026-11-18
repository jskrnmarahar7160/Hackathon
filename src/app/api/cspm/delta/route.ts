// GET /api/cspm/delta
// Compares the two most recent assessments and classifies every (check, resource)
// pair as new / resolved / recurring. Powers the drift / posture-change view.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeDelta } from "@/lib/cspm/delta";
import { computeScore } from "@/lib/cspm/engine";

export async function GET() {
  const account = await db.cloudAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) return NextResponse.json({ error: "No account" }, { status: 404 });

  const assessments = await db.assessment.findMany({
    where: { accountId: account.id },
    orderBy: { startedAt: "desc" },
    take: 2,
    include: { findings: { include: { check: true, resource: true } } },
  });

  if (assessments.length < 2) {
    return NextResponse.json({
      delta: null,
      message: "Need at least two assessments to compute drift.",
    });
  }

  const [curr, prev] = assessments;
  const toLite = (f: (typeof prev.findings)[number]) => ({
    checkId: f.check.checkId,
    title: f.check.title,
    service: f.service,
    resourceName: f.resource.name,
    resourceType: f.resource.resourceType,
    severity: f.severity as "critical" | "high" | "medium" | "low",
    status: f.status,
    result: f.result,
  });

  const prevScore = computeScore(
    prev.findings.map((f) => ({
      checkId: f.check.checkId,
      resource: { service: f.service as never, resourceType: f.resource.resourceType, name: f.resource.name },
      severity: f.severity as never,
      result: f.result as never,
      evidence: JSON.parse(f.evidence) as never,
    }))
  );
  const currScore = computeScore(
    curr.findings.map((f) => ({
      checkId: f.check.checkId,
      resource: { service: f.service as never, resourceType: f.resource.resourceType, name: f.resource.name },
      severity: f.severity as never,
      result: f.result as never,
      evidence: JSON.parse(f.evidence) as never,
    }))
  );

  const delta = computeDelta(
    prev.findings.map(toLite),
    curr.findings.map(toLite),
    { id: prev.id, startedAt: prev.startedAt.toISOString(), score: prevScore },
    { id: curr.id, startedAt: curr.startedAt.toISOString(), score: currScore }
  );

  return NextResponse.json({ delta });
}
