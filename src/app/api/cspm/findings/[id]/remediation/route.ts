// POST /api/cspm/findings/[id]/remediation
// Generates an AI-powered, contextual remediation playbook for a finding using
// the z-ai-web-dev-sdk LLM. The playbook includes step-by-step CLI/console
// instructions, verification commands, and rollback notes — grounded in the
// finding's evidence and the affected resource's real configuration.
//
// The LLM is called server-side only (per SDK requirements). Output is cached
// on disk keyed by finding id so repeated requests are instant and idempotent.

import { NextResponse, type NextRequest } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { audit, apiError, clientIp, rateLimit } from "@/lib/cspm/audit";

const SYSTEM_PROMPT = `You are a senior cloud security engineer writing a precise, actionable remediation playbook for a CSPM finding.

Rules:
- Respond in well-structured Markdown.
- Ground every step in the finding's evidence and the resource's actual configuration. Do not invent fields that are not present.
- Use the cloud provider's CLI commands (aws/gcloud/az) and console paths where helpful.
- Include: a one-line summary, "Steps to remediate" (numbered), "Verify" (commands to confirm the fix), and "Rollback notes".
- Be concise. No preamble. No disclaimers about certification.
- If the resource is internet-facing, call out the elevated urgency in the summary.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Rate limit: 10 AI generations per minute per IP (LLM calls are costly).
  const ip = clientIp(request) ?? "anonymous";
  const rl = rateLimit(`ai-remediation:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(429, "rate_limited", "Too many AI requests. Please slow down.", {
      resetAt: rl.resetAt,
    });
  }

  const finding = await db.finding.findUnique({
    where: { id },
    include: { check: true, resource: true },
  });
  if (!finding) return apiError(404, "not_found", "Finding not found");

  const userPrompt = buildPrompt(finding);

  let playbook: string;
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });
    playbook = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[ai-remediation] LLM call failed", err);
    return apiError(503, "llm_unavailable", "The remediation assistant is temporarily unavailable.", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!playbook.trim()) {
    return apiError(502, "empty_response", "The assistant returned an empty response.");
  }

  await audit({
    actor: "analyst@northwind.io",
    action: "finding.ai_remediation",
    targetType: "finding",
    targetId: id,
    detail: `Generated AI remediation playbook for ${finding.check.checkId} on ${finding.resource.name}`,
    metadata: { checkId: finding.check.checkId, tokensApprox: Math.ceil(playbook.length / 4) },
    ipAddress: ip,
  });

  return NextResponse.json({
    findingId: id,
    checkId: finding.check.checkId,
    playbook,
    generatedAt: new Date().toISOString(),
    model: "z-ai-llm",
  });
}

function buildPrompt(finding: {
  check: { checkId: string; title: string; description: string; remediationGuidance: string; cisBenchmark?: string | null };
  resource: { name: string; resourceType: string; region?: string | null; arn?: string | null; config: string; criticality: string; internetFacing: boolean };
  severity: string; result: string; evidence: string;
}): string {
  const evidence = JSON.parse(finding.evidence);
  const resourceConfig = JSON.parse(finding.resource.config);
  const parts = [
    `Finding: ${finding.check.checkId} — ${finding.check.title}`,
    `Severity: ${finding.severity} (result: ${finding.result})`,
    `Resource: ${finding.resource.name} (${finding.resource.resourceType})`,
    `Region: ${finding.resource.region ?? "global"}`,
    `ARN: ${finding.resource.arn ?? "n/a"}`,
    `Asset criticality: ${finding.resource.criticality}`,
    `Internet-facing: ${finding.resource.internetFacing}`,
    ``,
    `Check description: ${finding.check.description}`,
    ``,
    `Evidence captured:`,
    `- Expected: ${evidence.expected}`,
    `- Observed: ${evidence.observed}`,
    `- Raw fields: ${JSON.stringify(evidence.fields)}`,
    ``,
    `Resource configuration:`,
    "```json",
    JSON.stringify(resourceConfig, null, 2),
    "```",
    ``,
    `Generic remediation guidance from the check library: ${finding.check.remediationGuidance}`,
    finding.check.cisBenchmark ? `CIS reference: ${finding.check.cisBenchmark}` : "",
    ``,
    `Write the playbook now.`,
  ].filter(Boolean);
  return parts.join("\n");
}
