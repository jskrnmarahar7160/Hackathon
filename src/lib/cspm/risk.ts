// Business-aware risk scoring and attack-path analysis.
//
// Risk score (0..100) combines:
//   - control severity (how bad is this control failing in general)
//   - asset criticality (how important is the affected resource to the business)
//   - exposure (is the resource internet-facing → bigger blast radius)
//
// Attack paths chain related findings into scenarios that show how individual
// misconfigurations combine into a larger real-world risk. This moves the
// platform from "list of findings" → "narrative of risk", which is far more
// actionable for defenders and far more compelling for executives.

import type { Severity } from "./types";

export type Criticality = "low" | "medium" | "high" | "critical";

const SEVERITY_BASE: Record<Severity, number> = {
  critical: 80,
  high: 60,
  medium: 40,
  low: 20,
};

const CRITICALITY_MULT: Record<Criticality, number> = {
  low: 0.7,
  medium: 1.0,
  high: 1.2,
  critical: 1.4,
};

/// Compute a 0..100 business-aware risk score for a finding.
export function computeRiskScore(
  severity: Severity,
  criticality: Criticality,
  internetFacing: boolean
): number {
  const base = SEVERITY_BASE[severity];
  const mult = CRITICALITY_MULT[criticality];
  const exposure = internetFacing ? 1.15 : 1.0;
  const raw = base * mult * exposure;
  return Math.max(1, Math.min(100, Math.round(raw)));
}

export const RISK_BANDS: Array<{ max: number; label: string; color: string }> = [
  { max: 100, label: "Critical", color: "#e11d48" },
  { max: 70, label: "High", color: "#ea580c" },
  { max: 45, label: "Medium", color: "#d97706" },
  { max: 0, label: "Low", color: "#64748b" },
];

export function riskBand(score: number) {
  for (const b of RISK_BANDS) {
    if (score >= b.max || (b.max === 0 && score >= 0)) {
      if (b.max === 0 || score >= (RISK_BANDS[RISK_BANDS.indexOf(b) + 1]?.max ?? 0) + 1) return b;
    }
  }
  return RISK_BANDS[RISK_BANDS.length - 1];
}

// ─────────────────────── Attack path templates ───────────────────────

export interface AttackPathStep {
  checkId: string;
  service: string;
  title: string;
  severity: Severity;
  resourceName: string;
  resourceType: string;
}

export interface AttackPath {
  id: string;
  name: string;
  scenario: string;
  impact: string;
  blastRadius: number; // 0..100
  category: "data_exfiltration" | "initial_access" | "privilege_escalation" | "lateral_movement" | "audit_evasion";
  steps: AttackPathStep[];
}

interface PathTemplate {
  id: string;
  name: string;
  category: AttackPath["category"];
  impact: string;
  scenario: string;
  /// Each entry is a set of checkIds that satisfy that step (any match).
  steps: Array<{ anyOf: string[]; role: string }>;
}

const PATH_TEMPLATES: PathTemplate[] = [
  {
    id: "PATH-DATA-EXFIL",
    name: "Silent cloud data exfiltration",
    category: "data_exfiltration",
    impact:
      "An unauthenticated attacker can locate, read and exfiltrate sensitive objects with no forensic trail, triggering breach-notification obligations.",
    scenario:
      "A publicly readable storage bucket with no encryption and no access logging creates a silent exfiltration path: the attacker reads objects directly, the objects are not protected by KMS, and no access log is generated to detect the read.",
    steps: [
      { anyOf: ["STO-001"], role: "Public exposure" },
      { anyOf: ["STO-002", "ENC-004", "ENC-002", "ENC-003"], role: "No encryption at rest" },
      { anyOf: ["STO-005", "LOG-004"], role: "No access logging" },
    ],
  },
  {
    id: "PATH-INITIAL-RDP",
    name: "Initial access via exposed remote desktop",
    category: "initial_access",
    impact:
      "Ransomware operators gain an initial foothold by brute-forcing an internet-exposed RDP instance, then pivot to internal resources.",
    scenario:
      "An internet-exposed RDP security group combined with a default VPC and an unencrypted database creates a textbook ransomware entry path: brute-force RDP → land in default network → reach unencrypted DB.",
    steps: [
      { anyOf: ["NET-002", "NET-001"], role: "Internet-exposed admin port" },
      { anyOf: ["NET-004"], role: "Flat / default network" },
      { anyOf: ["ENC-003", "ENC-002"], role: "Unencrypted data store" },
    ],
  },
  {
    id: "PATH-ROOT-TAKEOVER",
    name: "Root account takeover",
    category: "privilege_escalation",
    impact:
      "Full, unrestricted compromise of the entire cloud account including all data, billing, and downstream resources.",
    scenario:
      "A root account without MFA and with an active access key can be fully compromised via credential theft or phishing, giving the attacker unrestricted control over every resource in the account.",
    steps: [
      { anyOf: ["IAM-001"], role: "Root MFA disabled" },
      { anyOf: ["IAM-002"], role: "Root programmatic key" },
    ],
  },
  {
    id: "PATH-AUDIT-EVASION",
    name: "Audit-trail evasion",
    category: "audit_evasion",
    impact:
      "An attacker can perform actions across regions or tamper with logs without detection, eliminating forensic evidence.",
    scenario:
      "A disabled or single-region CloudTrail with log validation off and no Config recorder means an attacker can take destructive actions across regions with no management-plane audit trail.",
    steps: [
      { anyOf: ["LOG-001"], role: "No multi-region trail" },
      { anyOf: ["LOG-002", "LOG-004"], role: "No integrity / no bucket logging" },
      { anyOf: ["LOG-005"], role: "Config recorder disabled" },
    ],
  },
  {
    id: "PATH-LATERAL-IDENTITY",
    name: "Identity-based lateral movement",
    category: "lateral_movement",
    impact:
      "A compromised low-privilege identity escalates and moves laterally because of weak credential hygiene across the IAM estate.",
    scenario:
      "Console users without MFA combined with long-lived unrotated access keys and stale credentials give an attacker multiple independent paths to escalate and persist.",
    steps: [
      { anyOf: ["IAM-003"], role: "User without MFA" },
      { anyOf: ["IAM-004"], role: "Stale access keys" },
      { anyOf: ["IAM-006"], role: "Unused credentials retained" },
    ],
  },
];

export interface AttackPathInput {
  checkId: string;
  service: string;
  title: string;
  severity: Severity;
  resourceName: string;
  resourceType: string;
}

/// Match finding instances against attack-path templates. A template "fires"
/// when at least one finding satisfies every step.
export function buildAttackPaths(findings: AttackPathInput[]): AttackPath[] {
  const paths: AttackPath[] = [];

  for (const tpl of PATH_TEMPLATES) {
    const steps: AttackPathStep[] = [];
    let satisfied = true;
    for (const step of tpl.steps) {
      const match = findings.find((f) => step.anyOf.includes(f.checkId));
      if (!match) {
        satisfied = false;
        break;
      }
      steps.push({
        checkId: match.checkId,
        service: match.service,
        title: match.title,
        severity: match.severity,
        resourceName: match.resourceName,
        resourceType: match.resourceType,
      });
    }
    if (satisfied) {
      const severityWeight = steps.reduce(
        (s, st) => s + (SEVERITY_BASE[st.severity] ?? 0),
        0
      );
      const blastRadius = Math.min(100, Math.round((severityWeight / (steps.length * 80)) * 100));
      paths.push({
        id: tpl.id,
        name: tpl.name,
        category: tpl.category,
        scenario: tpl.scenario,
        impact: tpl.impact,
        blastRadius,
        steps,
      });
    }
  }

  return paths.sort((a, b) => b.blastRadius - a.blastRadius);
}

export const ATTACK_PATH_CATEGORY_META: Record<
  AttackPath["category"],
  { label: string; color: string; icon: string }
> = {
  data_exfiltration: { label: "Data Exfiltration", color: "#e11d48", icon: "database" },
  initial_access: { label: "Initial Access", color: "#f97316", icon: "door-open" },
  privilege_escalation: { label: "Privilege Escalation", color: "#7c3aed", icon: "crown" },
  lateral_movement: { label: "Lateral Movement", color: "#0891b2", icon: "git-branch" },
  audit_evasion: { label: "Audit Evasion", color: "#db2777", icon: "eye-off" },
};
