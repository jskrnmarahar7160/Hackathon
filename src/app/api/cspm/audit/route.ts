// GET /api/cspm/audit
// Returns the append-only audit log. The platform itself is auditable.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit") ?? 50), 200);
  const action = sp.get("action") || undefined;

  const logs = await db.auditLog.findMany({
    where: action ? { action } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const rows = logs.map((l) => ({
    id: l.id,
    actor: l.actor,
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId,
    detail: l.detail,
    metadata: l.metadata ? JSON.parse(l.metadata) : null,
    ipAddress: l.ipAddress,
    createdAt: l.createdAt.toISOString(),
  }));

  return NextResponse.json({ audit: rows, total: rows.length });
}
