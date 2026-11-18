// Seeds the CSPM database with:
//   1. A sample read-only cloud account.
//   2. The documented security checks library.
//   3. Cloud resources (with criticality + internet-facing flags) from a sample
//      read-only snapshot.
//   4. A baseline assessment + a current assessment producing findings with
//      computed risk scores and evidence. The baseline differs from the current
//      snapshot so the delta/drift view has real "new" and "resolved" findings.
//   5. Compliance snapshots for trend tracking (historical + current).
//   6. An initial set of audit-log entries so the audit trail is non-empty.
//
// Run with: `bun run src/lib/cspm/seed.ts`

import { db } from "@/lib/db";
import { SECURITY_CHECKS } from "@/lib/cspm/checks";
import { SAMPLE_ACCOUNT, SAMPLE_SNAPSHOT } from "@/lib/cspm/snapshot";
import { runAssessment, computeScore, severityCounts } from "@/lib/cspm/engine";
import { computeRiskScore } from "@/lib/cspm/risk";
import type { Severity, Criticality } from "@/lib/cspm/risk";

async function main() {
  console.log("Seeding CSPM database (v2)…");

  // 1. Cloud account (read-only)
  const account = await db.cloudAccount.upsert({
    where: {
      provider_accountId: {
        provider: SAMPLE_ACCOUNT.provider,
        accountId: SAMPLE_ACCOUNT.accountId,
      },
    },
    update: {
      displayName: SAMPLE_ACCOUNT.displayName,
      region: SAMPLE_ACCOUNT.region,
      scanMode: "read-only",
      lastSyncedAt: new Date(),
    },
    create: {
      provider: SAMPLE_ACCOUNT.provider,
      accountId: SAMPLE_ACCOUNT.accountId,
      displayName: SAMPLE_ACCOUNT.displayName,
      region: SAMPLE_ACCOUNT.region,
      scanMode: "read-only",
      lastSyncedAt: new Date(),
    },
  });
  console.log(`  account: ${account.displayName} (${account.id})`);

  // 2. Security checks library
  for (const check of SECURITY_CHECKS) {
    await db.securityCheck.upsert({
      where: { checkId: check.checkId },
      update: {
        service: check.service,
        title: check.title,
        description: check.description,
        rationale: check.rationale,
        severity: check.severity,
        cisBenchmark: check.cisBenchmark ?? null,
        iso27001Controls: check.iso27001Controls ?? null,
        remediationGuidance: check.remediationGuidance,
        remediationEffort: check.remediationEffort,
        evaluationLogic: check.evaluationLogic,
      },
      create: {
        checkId: check.checkId,
        service: check.service,
        title: check.title,
        description: check.description,
        rationale: check.rationale,
        severity: check.severity,
        cisBenchmark: check.cisBenchmark ?? null,
        iso27001Controls: check.iso27001Controls ?? null,
        remediationGuidance: check.remediationGuidance,
        remediationEffort: check.remediationEffort,
        evaluationLogic: check.evaluationLogic,
      },
    });
  }
  console.log(`  checks: ${SECURITY_CHECKS.length}`);

  // 3. Resources (with criticality + internetFacing)
  for (const r of SAMPLE_SNAPSHOT) {
    await db.resource.upsert({
      where: { id: r.id },
      update: {
        accountId: account.id,
        service: r.service,
        resourceType: r.resourceType,
        name: r.name,
        region: r.region ?? null,
        arn: r.arn ?? null,
        config: JSON.stringify(r.config),
        criticality: r.criticality ?? "medium",
        internetFacing: r.internetFacing ?? false,
        lastSeenAt: new Date(),
      },
      create: {
        id: r.id,
        accountId: account.id,
        service: r.service,
        resourceType: r.resourceType,
        name: r.name,
        region: r.region ?? null,
        arn: r.arn ?? null,
        config: JSON.stringify(r.config),
        criticality: r.criticality ?? "medium",
        internetFacing: r.internetFacing ?? false,
        lastSeenAt: new Date(),
      },
    });
  }
  console.log(`  resources: ${SAMPLE_SNAPSHOT.length}`);

  const checkRows = await db.securityCheck.findMany();
  const checkIdMap = new Map(checkRows.map((c) => [c.checkId, c.id]));

  // ── 4a. Baseline assessment (older, ~7 days ago) ──
  // Construct a baseline that is realistic: some issues have since been
  // remediated (→ "resolved" in the delta), while others have regressed
  // (→ "new" in the delta). This gives the drift view a mixed, truthful story.
  const baselineSnapshot = SAMPLE_SNAPSHOT.map((s) => {
    // Regressions (baseline was clean, current is bad → NEW in delta):
    if (s.id === "snap-s3-public") {
      return { ...s, config: { ...s.config, acl: [], blockPublicAccess: true } }; // was clean → now exposed
    }
    if (s.id === "snap-rds-staging") {
      return { ...s, config: { ...s.config, storageEncrypted: true } }; // was encrypted → now not
    }
    // Improvements (baseline was bad, current is clean → RESOLVED in delta):
    if (s.id === "snap-s3-datalake") {
      return { ...s, config: { ...s.config, acl: [{ grantee: "AllUsers", permission: "READ" }] } }; // was public → now clean
    }
    if (s.id === "snap-kms-appkey") {
      return { ...s, config: { ...s.config, keyRotationEnabled: false } }; // was off → now on
    }
    if (s.id === "snap-cloudtrail") {
      return { ...s, config: { ...s.config, logFileValidationEnabled: false } }; // was off → now on
    }
    return s;
  });
  const baselineStartedAt = new Date(Date.now() - 7 * 86_400_000);
  const baselineFindings = runAssessment(baselineSnapshot);
  const baselineDuration = 410;
  const baselineCompletedAt = new Date(baselineStartedAt.getTime() + baselineDuration);
  const baselinePassed = baselineFindings.filter((f) => f.result === "pass").length;
  const baselineFailed = baselineFindings.filter((f) => f.result === "fail").length;

  const baselineAssessment = await db.assessment.create({
    data: {
      accountId: account.id,
      status: "completed",
      trigger: "scheduled",
      totalChecks: baselineFindings.length,
      passed: baselinePassed,
      failed: baselineFailed,
      errors: 0,
      durationMs: baselineDuration,
      startedAt: baselineStartedAt,
      completedAt: baselineCompletedAt,
    },
  });

  for (const f of baselineFindings) {
    const snapResource = baselineSnapshot.find(
      (s) => s.resourceType === f.resource.resourceType && s.name === f.resource.name
    );
    if (!snapResource) continue;
    const criticality = (snapResource.criticality ?? "medium") as Criticality;
    const riskScore = computeRiskScore(f.severity, criticality, snapResource.internetFacing ?? false);
    await db.finding.create({
      data: {
        assessmentId: baselineAssessment.id,
        checkId: checkIdMap.get(f.checkId)!,
        resourceId: snapResource.id,
        service: f.resource.service,
        severity: f.severity,
        status: "open",
        result: f.result,
        evidence: JSON.stringify(f.evidence),
        riskScore,
        firstDetectedAt: baselineStartedAt,
        lastDetectedAt: baselineCompletedAt,
      },
    });
  }
  console.log(`  baseline assessment: ${baselineFindings.length} evaluations (${baselinePassed} pass / ${baselineFailed} fail)`);

  // Baseline compliance snapshot
  const baselineSev = severityCounts(baselineFindings.filter((f) => f.result !== "pass"));
  const baselineScore = computeScore(baselineFindings);
  await db.complianceSnapshot.create({
    data: {
      accountId: account.id,
      takenAt: baselineCompletedAt,
      totalChecks: baselineFindings.length,
      passed: baselinePassed,
      failed: baselineFailed,
      critical: baselineSev.critical,
      high: baselineSev.high,
      medium: baselineSev.medium,
      low: baselineSev.low,
      openCount: baselineFailed,
      resolvedCount: 0,
      score: baselineScore,
    },
  });

  // ── 4b. Current assessment (the latest full snapshot) ──
  const startedAt = new Date();
  const findings = runAssessment(SAMPLE_SNAPSHOT);
  const durationMs = 420;
  const completedAt = new Date(startedAt.getTime() + durationMs);
  const passed = findings.filter((f) => f.result === "pass").length;
  const failed = findings.filter((f) => f.result === "fail").length;

  const assessment = await db.assessment.create({
    data: {
      accountId: account.id,
      status: "completed",
      trigger: "manual",
      totalChecks: findings.length,
      passed,
      failed,
      errors: 0,
      durationMs,
      startedAt,
      completedAt,
    },
  });
  console.log(`  current assessment: ${findings.length} evaluations (${passed} pass / ${failed} fail)`);

  for (const f of findings) {
    const snapResource = SAMPLE_SNAPSHOT.find(
      (s) => s.resourceType === f.resource.resourceType && s.name === f.resource.name
    );
    if (!snapResource) continue;
    const criticality = (snapResource.criticality ?? "medium") as Criticality;
    const riskScore = computeRiskScore(f.severity as Severity, criticality, snapResource.internetFacing ?? false);
    await db.finding.create({
      data: {
        assessmentId: assessment.id,
        checkId: checkIdMap.get(f.checkId)!,
        resourceId: snapResource.id,
        service: f.resource.service,
        severity: f.severity,
        status: "open",
        result: f.result,
        evidence: JSON.stringify(f.evidence),
        riskScore,
        firstDetectedAt: startedAt,
        lastDetectedAt: completedAt,
      },
    });
  }
  console.log(`  findings persisted: ${findings.length}`);

  // Current compliance snapshot
  const sev = severityCounts(findings.filter((f) => f.result !== "pass"));
  const score = computeScore(findings);
  await db.complianceSnapshot.create({
    data: {
      accountId: account.id,
      takenAt: completedAt,
      totalChecks: findings.length,
      passed,
      failed,
      critical: sev.critical,
      high: sev.high,
      medium: sev.medium,
      low: sev.low,
      openCount: failed,
      resolvedCount: 0,
      score,
    },
  });

  // Historical points for the trend (older than the baseline)
  const now = Date.now();
  const history = [
    { d: 35, score: 42, open: 18, resolved: 2 },
    { d: 28, score: 48, open: 17, resolved: 3 },
    { d: 21, score: 51, open: 16, resolved: 5 },
    { d: 14, score: 55, open: 15, resolved: 6 },
  ];
  for (const h of history) {
    await db.complianceSnapshot.create({
      data: {
        accountId: account.id,
        takenAt: new Date(now - h.d * 86_400_000),
        totalChecks: findings.length,
        passed,
        failed: h.open,
        critical: Math.max(0, sev.critical - 1),
        high: Math.max(0, sev.high - 1),
        medium: sev.medium,
        low: sev.low,
        openCount: h.open,
        resolvedCount: h.resolved,
        score: h.score,
      },
    });
  }
  console.log(`  compliance snapshots: ${history.length + 2}`);

  // 6. Seed audit log entries
  await db.auditLog.createMany({
    data: [
      {
        actor: "system",
        action: "account.connected",
        targetType: "account",
        targetId: account.id,
        detail: `Connected ${account.provider} account ${account.displayName} in read-only scan mode`,
        metadata: JSON.stringify({ provider: account.provider, scanMode: "read-only" }),
        createdAt: new Date(now - 35 * 86_400_000),
      },
      {
        actor: "system",
        action: "assessment.run",
        targetType: "assessment",
        targetId: baselineAssessment.id,
        detail: `Scheduled assessment run produced ${baselineFailed} findings`,
        metadata: JSON.stringify({ trigger: "scheduled", score: baselineScore }),
        createdAt: baselineCompletedAt,
      },
      {
        actor: "analyst@northwind.io",
        action: "report.download",
        targetType: "report",
        detail: "Downloaded assessment report (JSON)",
        createdAt: new Date(now - 2 * 86_400_000),
      },
      {
        actor: "system",
        action: "assessment.run",
        targetType: "assessment",
        targetId: assessment.id,
        detail: `Manual assessment run produced ${failed} findings`,
        metadata: JSON.stringify({ trigger: "manual", score }),
        createdAt: completedAt,
      },
    ],
  });
  console.log(`  audit log entries: 4`);

  console.log("Seed complete (v2).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
