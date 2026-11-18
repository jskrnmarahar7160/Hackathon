// Core domain types for the CSPM platform.
// These types describe the read-only configuration data captured from
// authorized cloud accounts, the documented security checks, and the
// findings produced by the assessment engine.

export type CloudProvider = "aws" | "gcp" | "azure";

export type Service =
  | "iam"
  | "storage"
  | "networking"
  | "encryption"
  | "logging";

export type Severity = "critical" | "high" | "medium" | "low";

export type FindingStatus = "open" | "in_progress" | "resolved" | "suppressed";

export type CheckResult = "pass" | "fail" | "error" | "not_applicable";

export type RemediationEffort = "low" | "medium" | "high";

/// A raw cloud resource captured during a read-only configuration scan.
export interface ResourceConfig {
  id: string;
  service: Service;
  resourceType: string; // e.g. "aws_iam_user", "aws_s3_bucket"
  name: string;
  region?: string;
  arn?: string;
  /// Business criticality of the asset — drives risk scoring.
  criticality?: "low" | "medium" | "high" | "critical";
  /// Whether the resource is reachable from the internet — drives blast radius.
  internetFacing?: boolean;
  config: Record<string, unknown>;
}

/// Structured evidence captured for a single check evaluation.
export interface Evidence {
  observed: string; // human-readable summary of what was observed
  expected: string; // human-readable summary of the expected state
  fields: Record<string, unknown>; // raw fields from the resource config
}

/// The outcome of running a single check against a single resource.
export interface CheckEvaluation {
  result: CheckResult;
  evidence: Evidence;
  message: string;
}

/// A documented security check definition with its evaluation logic.
export interface SecurityCheckDefinition {
  checkId: string;
  service: Service;
  title: string;
  description: string;
  rationale: string;
  severity: Severity;
  cisBenchmark?: string;
  iso27001Controls?: string;
  remediationGuidance: string;
  remediationEffort: RemediationEffort;
  evaluationLogic: string;
  appliesTo: string[]; // resource types this check evaluates
  evaluate: (resource: ResourceConfig) => CheckEvaluation | null;
}

/// A finding produced by the engine, ready to be persisted.
export interface FindingRecord {
  checkId: string;
  resource: {
    service: Service;
    resourceType: string;
    name: string;
    region?: string;
    arn?: string;
    config: Record<string, unknown>;
  };
  severity: Severity;
  result: CheckResult;
  evidence: Evidence;
  message: string;
}

/// Aggregated dashboard metrics.
export interface DashboardMetrics {
  account: {
    id: string;
    provider: string;
    accountId: string;
    displayName: string;
    region?: string;
    lastSyncedAt?: string;
  };
  totals: {
    checks: number;
    resources: number;
    findings: number;
    openFindings: number;
    resolvedFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  score: number; // 0..100 weighted compliance score
  passRate: number; // 0..100
  byService: Array<{
    service: Service;
    total: number;
    passed: number;
    failed: number;
    open: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    score: number;
  }>;
  byStatus: { open: number; in_progress: number; resolved: number; suppressed: number };
  trend: Array<{
    takenAt: string;
    score: number;
    open: number;
    resolved: number;
  }>;
  lastAssessment?: {
    id: string;
    startedAt: string;
    completedAt?: string;
    totalChecks: number;
    passed: number;
    failed: number;
  };
}
