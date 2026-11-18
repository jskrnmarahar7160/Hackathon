// GET /api/cspm/health
// Lightweight readiness / liveness probe for deployment platforms (Vercel,
// Render, Fly). Confirms the database is reachable and reports key counters.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const started = Date.now();
  try {
    const [accounts, checks, resources, findings, assessments] = await Promise.all([
      db.cloudAccount.count(),
      db.securityCheck.count(),
      db.resource.count(),
      db.finding.count(),
      db.assessment.count(),
    ]);
    return NextResponse.json({
      status: "ok",
      uptime: "healthy",
      latencyMs: Date.now() - started,
      scanMode: "read-only",
      timestamp: new Date().toISOString(),
      counts: { accounts, checks, resources, findings, assessments },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        error: err instanceof Error ? err.message : "unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
