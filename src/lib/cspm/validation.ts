// Zod schemas for validating all API inputs. Centralised so every route uses
// the same validation rules and produces the same error shape.

import { z } from "zod/v4";

export const FINDING_STATUS = z.enum([
  "open",
  "in_progress",
  "resolved",
  "suppressed",
]);

export const patchFindingSchema = z.object({
  status: FINDING_STATUS,
  note: z.string().max(2000).optional(),
  author: z.string().max(120).default("analyst"),
});

export const runAssessmentSchema = z.object({
  trigger: z.enum(["manual", "scheduled"]).default("manual"),
});

export const findingQuerySchema = z.object({
  service: z.enum(["iam", "storage", "networking", "encryption", "logging"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: FINDING_STATUS.optional(),
  result: z.enum(["pass", "fail", "error", "not_applicable", "all"]).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  cursor: z.string().optional(),
});

export type PatchFinding = z.infer<typeof patchFindingSchema>;
export type FindingQuery = z.infer<typeof findingQuerySchema>;
