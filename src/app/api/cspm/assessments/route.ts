// GET  /api/cspm/assessments        — list assessment history
// POST /api/cspm/assessments/run    — run a new assessment against the latest
//                                     read-only snapshot and persist findings.
// (Run route lives at /api/cspm/assessments/run/route.ts)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const account = await db.cloudAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) return NextResponse.json({ error: "No account" }, { status: 404 });

  const assessments = await db.assessment.findMany({
    where: { accountId: account.id },
    orderBy: { startedAt: "desc" },
    take: 25,
  });

  const rows = assessments.map((a) => ({
    id: a.id,
    status: a.status,
    trigger: a.trigger,
    totalChecks: a.totalChecks,
    passed: a.passed,
    failed: a.failed,
    errors: a.errors,
    durationMs: a.durationMs,
    startedAt: a.startedAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ assessments: rows });
}
