// PATCH /api/cspm/findings/[id]
// Updates the remediation status of a finding (read-only platform: status is
// tracked locally, no cloud mutation occurs). Records a remediation event and
// an audit-log entry. Re-snapshots compliance trend.
//
// Body (validated with Zod): { status, note?, author? }

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit, apiError, clientIp } from "@/lib/cspm/audit";
import { patchFindingSchema } from "@/lib/cspm/validation";
import { computeScore } from "@/lib/cspm/engine";

const SEVERITY_WEIGHT: Record<string, number> = { critical: 10, high: 5, medium: 2, low: 1 };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return apiError(400, "invalid_body", "Request body must be valid JSON.");

  const parsed = patchFindingSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "validation_error", "Invalid request body.", {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const { status, note, author } = parsed.data;

  const finding = await db.finding.findUnique({ where: { id } });
  if (!finding) return apiError(404, "not_found", "Finding not found");

  const fromStatus = finding.status;
  const now = new Date();

  const updated = await db.finding.update({
    where: { id },
    data: {
      status,
      notes: note ?? finding.notes,
      resolvedAt: status === "resolved" ? now : null,
      lastDetectedAt: now,
    },
  });

  await db.remediation.create({
    data: {
      findingId: id,
      action: "status_change",
      fromStatus,
      toStatus: status,
      note,
      author,
    },
  });

  await audit({
    actor: author,
    action: "finding.status_change",
    targetType: "finding",
    targetId: id,
    detail: `${finding.checkId}: ${fromStatus} → ${status}${note ? ` ("${note.slice(0, 80)}")` : ""}`,
    metadata: { fromStatus, toStatus, checkId: finding.checkId, resourceId: finding.resourceId, note },
    ipAddress: clientIp(request),
  });

  // Re-snapshot compliance trend
  const assessment = await db.assessment.findUnique({ where: { id: finding.assessmentId } });
  if (assessment) {
    await refreshSnapshot(assessment.accountId, assessment.id);
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    notes: updated.notes,
  });
}

async function refreshSnapshot(accountId: string, assessmentId: string) {
  const findings = await db.finding.findMany({ where: { assessmentId } });
  const applicable = findings.filter((f) => f.result === "pass" || f.result === "fail");
  const maxW = applicable.reduce((s, f) => s + (SEVERITY_WEIGHT[f.severity] ?? 0), 0);
  const lostW = applicable.filter((f) => f.result === "fail").reduce((s, f) => s + (SEVERITY_WEIGHT[f.severity] ?? 0), 0);
  const score = maxW === 0 ? 100 : Math.round(((maxW - lostW) / maxW) * 100);
  const failed = findings.filter((f) => f.result === "fail");
  await db.complianceSnapshot.create({
    data: {
      accountId,
      takenAt: new Date(),
      totalChecks: findings.length,
      passed: findings.filter((f) => f.result === "pass").length,
      failed: failed.length,
      critical: failed.filter((f) => f.severity === "critical").length,
      high: failed.filter((f) => f.severity === "high").length,
      medium: failed.filter((f) => f.severity === "medium").length,
      low: failed.filter((f) => f.severity === "low").length,
      openCount: failed.filter((f) => f.status === "open").length,
      resolvedCount: findings.filter((f) => f.status === "resolved").length,
      score: computeScore(
        applicable.map((f) => ({
          checkId: f.checkId,
          resource: { service: f.service as never, resourceType: "", name: "" },
          severity: f.severity as never,
          result: f.result as never,
          evidence: JSON.parse(f.evidence) as never,
        }))
      ),
    },
  });
}
