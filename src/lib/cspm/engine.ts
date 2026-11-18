// Assessment engine.
//
// Evaluates a read-only cloud snapshot against the documented security
// checks library and produces structured findings with evidence. The engine
// is pure and deterministic: given the same snapshot and checks library, it
// always produces the same findings.

import { SECURITY_CHECKS } from "./checks";
import { SEVERITY_WEIGHT } from "./checks";
import type {
  FindingRecord,
  ResourceConfig,
  CheckResult,
  Severity,
} from "./types";

/// Run every applicable check against every resource in the snapshot.
/// Returns the list of finding records (one per (check, resource) pair that
/// applies). Pass results are included so compliance scores can be computed.
export function runAssessment(
  resources: ResourceConfig[]
): FindingRecord[] {
  const findings: FindingRecord[] = [];

  for (const check of SECURITY_CHECKS) {
    for (const resource of resources) {
      if (!check.appliesTo.includes(resource.resourceType)) continue;
      let evaluation;
      try {
        evaluation = check.evaluate(resource);
      } catch (err) {
        findings.push({
          checkId: check.checkId,
          resource: toResourceRef(resource),
          severity: check.severity,
          result: "error" as CheckResult,
          evidence: {
            observed: "Evaluator threw an error",
            expected: "Check evaluates without error",
            fields: { error: err instanceof Error ? err.message : String(err) },
          },
          message: "Check evaluation failed with an error.",
        });
        continue;
      }
      if (!evaluation) continue; // check returned null → not applicable
      findings.push({
        checkId: check.checkId,
        resource: toResourceRef(resource),
        severity: check.severity,
        result: evaluation.result,
        evidence: evaluation.evidence,
        message: evaluation.message,
      });
    }
  }

  return findings;
}

function toResourceRef(resource: ResourceConfig): FindingRecord["resource"] {
  return {
    service: resource.service,
    resourceType: resource.resourceType,
    name: resource.name,
    region: resource.region,
    arn: resource.arn,
    config: resource.config,
  };
}

/// Weighted compliance score (0..100). Failures of higher severity reduce the
/// score more sharply. Returns 100 when there are no findings.
export function computeScore(findings: FindingRecord[]): number {
  const applicable = findings.filter((f) => f.result === "pass" || f.result === "fail");
  if (applicable.length === 0) return 100;
  const failed = applicable.filter((f) => f.result === "fail");
  const maxWeight = applicable.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  const lostWeight = failed.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  if (maxWeight === 0) return 100;
  return Math.round(((maxWeight - lostWeight) / maxWeight) * 100);
}

export function severityCounts(findings: FindingRecord[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (f.result === "fail") counts[f.severity]++;
  }
  return counts;
}
