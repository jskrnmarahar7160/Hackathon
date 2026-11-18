// Shared helpers for audit logging, structured API responses, and rate limiting.
//
// Every state-changing operation in the platform writes an AuditLog entry so
// the platform itself is auditable — a critical property for a security tool.

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export interface AuditContext {
  actor: string;
  action: string;
  targetType: string;
  targetId?: string;
  detail: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/// Append an entry to the audit log. Never throws — audit failures must not
/// break the user-facing operation.
export async function audit(ctx: AuditContext): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actor: ctx.actor,
        action: ctx.action,
        targetType: ctx.targetType,
        targetId: ctx.targetId ?? null,
        detail: ctx.detail,
        metadata: ctx.metadata ? JSON.stringify(ctx.metadata) : null,
        ipAddress: ctx.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log", err);
  }
}

/// Standard error envelope so the frontend can rely on a consistent shape.
export function apiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: { code, message, details } },
    { status }
  );
}

/// In-memory sliding-window rate limiter. Adequate for a single-instance
/// prototype; swap for Redis in a multi-instance deployment.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }
  if (bucket.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count++;
  return { allowed: true, remaining: maxRequests - bucket.count, resetAt: bucket.resetAt };
}

/// Extract a best-effort client IP from Next.js request headers.
export function clientIp(request: Request): string | undefined {
  const headers = new Headers(request.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    undefined
  );
}
