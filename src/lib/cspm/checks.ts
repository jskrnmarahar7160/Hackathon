// Documented library of security checks for the CSPM platform.
//
// Each check is fully documented with:
//   - what it evaluates (description, evaluationLogic, appliesTo)
//   - why it matters (rationale)
//   - the default severity
//   - a mapping to a CIS Benchmark reference and ISO 27001:2022 controls
//   - remediation guidance and effort estimate
//
// IMPORTANT: Mappings to CIS / ISO 27001 are provided for internal alignment
// and traceability only. They do NOT constitute a certification or formal
// attestation of compliance.
//
// The platform operates in READ-ONLY mode: checks evaluate configuration data
// captured from authorized cloud APIs and never mutate cloud resources.

import type { SecurityCheckDefinition } from "./types";

export const SECURITY_CHECKS: SecurityCheckDefinition[] = [
  // ───────────────────────────── IAM ─────────────────────────────
  {
    checkId: "IAM-001",
    service: "iam",
    title: "Root account MFA should be enabled",
    description:
      "Verifies that multi-factor authentication is enabled for the cloud account root principal.",
    rationale:
      "The root principal has unrestricted access to all account resources. Without MFA, compromised root credentials allow full account takeover.",
    severity: "critical",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 1.1 (Ensure MFA is enabled for the root account)",
    iso27001Controls: "A.5.17 (Authentication information), A.8.5 (Secure authentication)",
    remediationGuidance:
      "Enable a virtual or hardware MFA device for the root account and store recovery codes in a secure offline location.",
    remediationEffort: "low",
    evaluationLogic:
      "Read the root account summary resource and confirm that `mfaEnabled === true`.",
    appliesTo: ["aws_iam_root"],
    evaluate: (r) => {
      const mfaEnabled = Boolean(r.config.mfaEnabled);
      return {
        result: mfaEnabled ? "pass" : "fail",
        evidence: {
          observed: mfaEnabled ? "MFA device registered on root account" : "No MFA device registered on root account",
          expected: "An MFA device must be registered on the root account",
          fields: { mfaEnabled, accountId: r.config.accountId },
        },
        message: mfaEnabled
          ? "Root account has MFA enabled."
          : "Root account does not have MFA enabled.",
      };
    },
  },
  {
    checkId: "IAM-002",
    service: "iam",
    title: "Root account must not have active access keys",
    description:
      "Verifies that the root account has no programmatic access keys.",
    rationale:
      "Root access keys grant unrestricted API access. They should never be used; programmatic access must use least-privilege IAM identities.",
    severity: "critical",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 1.2 (Ensure hardware MFA is enabled for the root account); 1.4 (Ensure no root access key exists)",
    iso27001Controls: "A.5.17 (Authentication information), A.8.2 (Privileged access rights)",
    remediationGuidance:
      "Delete any root access keys and rotate to a least-privilege IAM role/user with MFA enforced.",
    remediationEffort: "low",
    evaluationLogic:
      "Read the root account summary and confirm `activeAccessKeys === 0`.",
    appliesTo: ["aws_iam_root"],
    evaluate: (r) => {
      const keys = Number(r.config.activeAccessKeys ?? 0);
      return {
        result: keys === 0 ? "pass" : "fail",
        evidence: {
          observed: `${keys} active access key(s) on root account`,
          expected: "0 active access keys on the root account",
          fields: { activeAccessKeys: keys },
        },
        message:
          keys === 0
            ? "Root account has no active access keys."
            : `Root account has ${keys} active access key(s).`,
      };
    },
  },
  {
    checkId: "IAM-003",
    service: "iam",
    title: "MFA should be enabled for all IAM users with console access",
    description:
      "Verifies that every IAM user with a console password also has an MFA device.",
    rationale:
      "Console users without MFA are the most common path for credential-stuffing and phishing-based account compromise.",
    severity: "high",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 1.4 (Ensure MFA is enabled for all IAM users that have a console password)",
    iso27001Controls: "A.8.5 (Secure authentication), A.8.2 (Privileged access rights)",
    remediationGuidance:
      "Enroll the user in a virtual MFA device or remove console access if it is no longer required.",
    remediationEffort: "low",
    evaluationLogic:
      "For each IAM user, if `consoleAccess === true`, require `mfaEnabled === true`.",
    appliesTo: ["aws_iam_user"],
    evaluate: (r) => {
      const consoleAccess = Boolean(r.config.consoleAccess);
      const mfaEnabled = Boolean(r.config.mfaEnabled);
      if (!consoleAccess) return null; // not applicable: no console access
      return {
        result: mfaEnabled ? "pass" : "fail",
        evidence: {
          observed: `Console access: ${consoleAccess ? "yes" : "no"}, MFA: ${mfaEnabled ? "enabled" : "not enabled"}`,
          expected: "Console users must have MFA enabled",
          fields: { consoleAccess, mfaEnabled, userName: r.config.userName },
        },
        message: mfaEnabled
          ? "Console user has MFA enabled."
          : "Console user does not have MFA enabled.",
      };
    },
  },
  {
    checkId: "IAM-004",
    service: "iam",
    title: "IAM access keys should be rotated within 90 days",
    description:
      "Verifies that long-lived access keys are rotated at least every 90 days.",
    rationale:
      "Long-lived credentials increase the blast radius of a leak. Regular rotation limits exposure windows.",
    severity: "medium",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 1.11 (Ensure IAM access keys are rotated every 90 days or less)",
    iso27001Controls: "A.5.17 (Authentication information), A.8.24 (Use of cryptography)",
    remediationGuidance:
      "Create a replacement key, update consumers, deactivate and delete the stale key. Prefer IAM roles or short-lived credentials.",
    remediationEffort: "medium",
    evaluationLogic:
      "For each IAM user access key, compute age from `lastRotatedAt` and fail if > 90 days.",
    appliesTo: ["aws_iam_user"],
    evaluate: (r) => {
      const keys = (r.config.accessKeys as Array<Record<string, unknown>>) ?? [];
      if (keys.length === 0) {
        return {
          result: "pass",
          evidence: {
            observed: "No long-lived access keys",
            expected: "Access keys rotated within 90 days",
            fields: { keyCount: 0 },
          },
          message: "User has no long-lived access keys.",
        };
      }
      const now = Date.now();
      const stale = keys.filter((k) => {
        const rotatedAt = String(k.lastRotatedAt ?? k.createdAt ?? "");
        const ageDays = (now - new Date(rotatedAt).getTime()) / 86_400_000;
        return k.status === "Active" && ageDays > 90;
      });
      return {
        result: stale.length === 0 ? "pass" : "fail",
        evidence: {
          observed: `${stale.length} of ${keys.length} active key(s) older than 90 days`,
          expected: "All access keys rotated within 90 days",
          fields: { keyCount: keys.length, staleCount: stale.length, keys },
        },
        message:
          stale.length === 0
            ? "All access keys are within rotation policy."
            : `${stale.length} access key(s) exceed the 90-day rotation policy.`,
      };
    },
  },
  {
    checkId: "IAM-005",
    service: "iam",
    title: "IAM password policy should enforce minimum length of 14",
    description:
      "Verifies the account password policy requires at least 14 characters.",
    rationale:
      "Length is the strongest single contributor to password entropy. NIST 800-63B recommends ≥14 characters for human-chosen passwords.",
    severity: "medium",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 1.5 (Ensure IAM password policy requires minimum length of 14 or greater)",
    iso27001Controls: "A.5.17 (Authentication information), A.8.5 (Secure authentication)",
    remediationGuidance:
      "Update the account password policy to require a minimum length of 14 and reuse prevention.",
    remediationEffort: "low",
    evaluationLogic: "Read the password policy resource and confirm `minimumPasswordLength >= 14`.",
    appliesTo: ["aws_iam_password_policy"],
    evaluate: (r) => {
      const minLen = Number(r.config.minimumPasswordLength ?? 0);
      return {
        result: minLen >= 14 ? "pass" : "fail",
        evidence: {
          observed: `Minimum password length is ${minLen}`,
          expected: "Minimum password length of at least 14",
          fields: { minimumPasswordLength: minLen, requireSymbols: r.config.requireSymbols },
        },
        message: minLen >= 14 ? "Password policy meets length requirement." : `Password policy minimum length (${minLen}) is below 14.`,
      };
    },
  },
  {
    checkId: "IAM-006",
    service: "iam",
    title: "IAM credentials unused for more than 90 days should be removed",
    description:
      "Verifies that IAM users with no activity in the last 90 days are reviewed or removed.",
    rationale:
      "Unused credentials are dormant attack surface. Removing them reduces the chance of silent misuse by former staff or attackers.",
    severity: "low",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 1.3 (Ensure credentials unused for 90 days or greater are disabled)",
    iso27001Controls: "A.5.18 (Access rights), A.8.2 (Privileged access rights)",
    remediationGuidance:
      "Disable or remove the unused credential. If the identity is still required, document an exception.",
    remediationEffort: "low",
    evaluationLogic:
      "For each IAM user, if `lastUsedDays > 90`, fail.",
    appliesTo: ["aws_iam_user"],
    evaluate: (r) => {
      const lastUsedDays = Number(r.config.lastUsedDays ?? 0);
      return {
        result: lastUsedDays <= 90 ? "pass" : "fail",
        evidence: {
          observed: `Credential last used ${lastUsedDays} day(s) ago`,
          expected: "Credential used within the last 90 days",
          fields: { lastUsedDays, userName: r.config.userName },
        },
        message: lastUsedDays <= 90 ? "Credential is in active use." : `Credential unused for ${lastUsedDays} days.`,
      };
    },
  },

  // ─────────────────────────── Storage ───────────────────────────
  {
    checkId: "STO-001",
    service: "storage",
    title: "S3 buckets should not allow public read access",
    description:
      "Verifies that no S3 bucket grants public read/write access via ACL or policy.",
    rationale:
      "Unintended public buckets are a leading cause of large-scale data exfiltration and regulatory breach notifications.",
    severity: "critical",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 2.1.1 (Ensure S3 buckets are not publicly accessible)",
    iso27001Controls: "A.8.12 (Data leakage), A.5.34 (Privacy and protection of PII)",
    remediationGuidance:
      "Remove public ACLs/grants and apply a bucket policy that denies `Principal: *` except where explicitly required and reviewed.",
    remediationEffort: "low",
    evaluationLogic:
      "Read bucket ACL/grants; fail if any grantee is `AllUsers` or `AuthenticatedUsers` with READ/WRITE.",
    appliesTo: ["aws_s3_bucket"],
    evaluate: (r) => {
      const grants = (r.config.acl as Array<Record<string, unknown>>) ?? [];
      const publicGrants = grants.filter(
        (g) => g.grantee === "AllUsers" || g.grantee === "AuthenticatedUsers"
      );
      return {
        result: publicGrants.length === 0 ? "pass" : "fail",
        evidence: {
          observed: `${publicGrants.length} public grant(s) on bucket`,
          expected: "No public grants (AllUsers / AuthenticatedUsers)",
          fields: { bucketName: r.config.bucketName, grants },
        },
        message: publicGrants.length === 0 ? "Bucket is not publicly accessible." : "Bucket grants public access.",
      };
    },
  },
  {
    checkId: "STO-002",
    service: "storage",
    title: "S3 buckets should have default encryption enabled",
    description:
      "Verifies that every S3 bucket has default server-side encryption configured.",
    rationale:
      "Default encryption guarantees that objects are encrypted at rest even if the uploading client omits encryption headers.",
    severity: "high",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 2.1.2 (Ensure S3 buckets have default encryption enabled)",
    iso27001Controls: "A.8.24 (Use of cryptography), A.8.12 (Data leakage)",
    remediationGuidance:
      "Enable default SSE-KMS or SSE-S3 encryption on the bucket and apply a bucket policy denying unencrypted PUTs.",
    remediationEffort: "low",
    evaluationLogic: "Read bucket config; fail if `serverSideEncryption` is not set.",
    appliesTo: ["aws_s3_bucket"],
    evaluate: (r) => {
      const sse = r.config.serverSideEncryption;
      return {
        result: sse ? "pass" : "fail",
        evidence: {
          observed: sse ? `Encryption: ${sse}` : "No default encryption configured",
          expected: "Default server-side encryption (SSE-S3 or SSE-KMS)",
          fields: { bucketName: r.config.bucketName, serverSideEncryption: sse ?? null },
        },
        message: sse ? "Bucket has default encryption enabled." : "Bucket has no default encryption.",
      };
    },
  },
  {
    checkId: "STO-003",
    service: "storage",
    title: "S3 buckets should have versioning enabled",
    description:
      "Verifies that object versioning is enabled to support recovery from accidental deletion or overwrite.",
    rationale:
      "Versioning is a precondition for MFA-delete and ransomware recovery workflows.",
    severity: "medium",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 2.1.3 (Ensure S3 bucket versioning is enabled)",
    iso27001Controls: "A.8.13 (Information backup), A.8.10 (Information deletion)",
    remediationGuidance:
      "Enable versioning on the bucket and consider MFA-delete for sensitive data.",
    remediationEffort: "low",
    evaluationLogic: "Read bucket config; fail if `versioning !== 'Enabled'`.",
    appliesTo: ["aws_s3_bucket"],
    evaluate: (r) => {
      const v = String(r.config.versioning ?? "Suspended");
      return {
        result: v === "Enabled" ? "pass" : "fail",
        evidence: {
          observed: `Versioning: ${v}`,
          expected: "Versioning Enabled",
          fields: { bucketName: r.config.bucketName, versioning: v },
        },
        message: v === "Enabled" ? "Versioning is enabled." : "Versioning is not enabled.",
      };
    },
  },
  {
    checkId: "STO-004",
    service: "storage",
    title: "S3 Block Public Access should be enabled at the bucket level",
    description:
      "Verifies that bucket-level Block Public Access is enabled to override any per-object public ACLs.",
    rationale:
      "Block Public Access is the strongest single guardrail against accidental public exposure and complements bucket policies.",
    severity: "high",
    iso27001Controls: "A.8.12 (Data leakage), A.8.20 (Networks security)",
    remediationGuidance:
      "Enable all four Block Public Access settings on the bucket and at the account level.",
    remediationEffort: "low",
    evaluationLogic: "Read bucket config; fail if `blockPublicAccess !== true`.",
    appliesTo: ["aws_s3_bucket"],
    evaluate: (r) => {
      const bpa = Boolean(r.config.blockPublicAccess);
      return {
        result: bpa ? "pass" : "fail",
        evidence: {
          observed: `Block Public Access: ${bpa ? "enabled" : "disabled"}`,
          expected: "Block Public Access enabled",
          fields: { bucketName: r.config.bucketName, blockPublicAccess: bpa },
        },
        message: bpa ? "Block Public Access is enabled." : "Block Public Access is disabled.",
      };
    },
  },
  {
    checkId: "STO-005",
    service: "storage",
    title: "S3 server access logging should be enabled",
    description:
      "Verifies that server access logging is configured for auditability of bucket access.",
    rationale:
      "Access logs are essential for incident investigation and detection of unauthorized reads/writes.",
    severity: "low",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 2.1.4 (Ensure S3 bucket access logging is enabled on the CloudTrail S3 bucket)",
    iso27001Controls: "A.8.15 (Logging), A.8.16 (Monitoring activities)",
    remediationGuidance:
      "Configure server access logging to a dedicated logging bucket with restricted permissions.",
    remediationEffort: "low",
    evaluationLogic: "Read bucket config; fail if `accessLogging !== true`.",
    appliesTo: ["aws_s3_bucket"],
    evaluate: (r) => {
      const logging = Boolean(r.config.accessLogging);
      return {
        result: logging ? "pass" : "fail",
        evidence: {
          observed: `Access logging: ${logging ? "enabled" : "disabled"}`,
          expected: "Server access logging enabled",
          fields: { bucketName: r.config.bucketName, accessLogging: logging },
        },
        message: logging ? "Access logging is enabled." : "Access logging is disabled.",
      };
    },
  },

  // ────────────────────────── Networking ──────────────────────────
  {
    checkId: "NET-001",
    service: "networking",
    title: "Security groups should not allow SSH (22) from 0.0.0.0/0",
    description:
      "Verifies that no inbound rule exposes port 22 to the entire internet.",
    rationale:
      "Open SSH is the most heavily brute-forced service on the internet. Access should be restricted to bastion or Session Manager paths.",
    severity: "high",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 4.1 (Ensure no security groups allow ingress from 0.0.0.0/0 to port 22)",
    iso27001Controls: "A.8.20 (Networks security), A.8.21 (Security of network services)",
    remediationGuidance:
      "Restrict the rule to a known CIDR or remove it and use AWS Systems Manager Session Manager.",
    remediationEffort: "low",
    evaluationLogic:
      "Inspect ingress rules; fail if any rule has cidr `0.0.0.0/0` and port range includes 22.",
    appliesTo: ["aws_security_group"],
    evaluate: (r) => {
      const rules = (r.config.ingressRules as Array<Record<string, unknown>>) ?? [];
      const open = rules.find(
        (rule) => rule.cidr === "0.0.0.0/0" && String(rule.fromPort) === "22"
      );
      return {
        result: open ? "fail" : "pass",
        evidence: {
          observed: open ? `Ingress 22 from ${open.cidr}` : "No open SSH rule",
          expected: "No ingress on port 22 from 0.0.0.0/0",
          fields: { groupName: r.config.groupName, ingressRules: rules },
        },
        message: open ? "Security group exposes SSH to the internet." : "Security group does not expose SSH.",
      };
    },
  },
  {
    checkId: "NET-002",
    service: "networking",
    title: "Security groups should not allow RDP (3389) from 0.0.0.0/0",
    description:
      "Verifies that no inbound rule exposes port 3389 to the entire internet.",
    rationale:
      "RDP is a primary target for ransomware operators. Internet-exposed RDP frequently leads to full environment compromise.",
    severity: "critical",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 4.2 (Ensure no security groups allow ingress from 0.0.0.0/0 to port 3389)",
    iso27001Controls: "A.8.20 (Networks security), A.8.5 (Secure authentication)",
    remediationGuidance:
      "Remove the rule and require VPN/private connectivity or a bastion with MFA.",
    remediationEffort: "low",
    evaluationLogic:
      "Inspect ingress rules; fail if any rule has cidr `0.0.0.0/0` and port range includes 3389.",
    appliesTo: ["aws_security_group"],
    evaluate: (r) => {
      const rules = (r.config.ingressRules as Array<Record<string, unknown>>) ?? [];
      const open = rules.find(
        (rule) => rule.cidr === "0.0.0.0/0" && String(rule.fromPort) === "3389"
      );
      return {
        result: open ? "fail" : "pass",
        evidence: {
          observed: open ? `Ingress 3389 from ${open.cidr}` : "No open RDP rule",
          expected: "No ingress on port 3389 from 0.0.0.0/0",
          fields: { groupName: r.config.groupName, ingressRules: rules },
        },
        message: open ? "Security group exposes RDP to the internet." : "Security group does not expose RDP.",
      };
    },
  },
  {
    checkId: "NET-003",
    service: "networking",
    title: "Security groups should not allow all inbound traffic",
    description:
      "Verifies that no security group allows all ports and protocols from any source.",
    rationale:
      "An `allow all` rule defeats the purpose of segmentation and enables lateral movement after perimeter compromise.",
    severity: "high",
    iso27001Controls: "A.8.20 (Networks security), A.8.22 (Segregation of networks)",
    remediationGuidance:
      "Replace the rule with the minimum required ports and source CIDRs.",
    remediationEffort: "low",
    evaluationLogic:
      "Inspect ingress rules; fail if any rule has cidr `0.0.0.0/0`, fromPort 0, toPort 65535.",
    appliesTo: ["aws_security_group"],
    evaluate: (r) => {
      const rules = (r.config.ingressRules as Array<Record<string, unknown>>) ?? [];
      const open = rules.find(
        (rule) =>
          rule.cidr === "0.0.0.0/0" &&
          String(rule.fromPort) === "0" &&
          String(rule.toPort) === "65535"
      );
      return {
        result: open ? "fail" : "pass",
        evidence: {
          observed: open ? "All-port ingress from 0.0.0.0/0" : "No all-port ingress",
          expected: "No ingress rule allowing all ports from 0.0.0.0/0",
          fields: { groupName: r.config.groupName, ingressRules: rules },
        },
        message: open ? "Security group allows all inbound traffic." : "Security group has no all-port rule.",
      };
    },
  },
  {
    checkId: "NET-004",
    service: "networking",
    title: "Default VPC should not be used for production workloads",
    description:
      "Verifies that resources are not deployed into the default VPC.",
    rationale:
      "The default VPC has permissive settings and a flat network that complicates segmentation and least-privilege networking.",
    severity: "medium",
    iso27001Controls: "A.8.22 (Segregation of networks), A.8.20 (Networks security)",
    remediationGuidance:
      "Migrate workloads to a purpose-built VPC with private/public subnet tiers and delete the default VPC.",
    remediationEffort: "high",
    evaluationLogic: "Read VPC config; fail if `isDefault === true` and `inUse === true`.",
    appliesTo: ["aws_vpc"],
    evaluate: (r) => {
      const isDefault = Boolean(r.config.isDefault);
      const inUse = Boolean(r.config.inUse);
      return {
        result: !isDefault || !inUse ? "pass" : "fail",
        evidence: {
          observed: `Default: ${isDefault}, In use: ${inUse}`,
          expected: "Default VPC not used for production workloads",
          fields: { vpcId: r.config.vpcId, isDefault, inUse },
        },
        message: !isDefault || !inUse ? "Default VPC is not in use." : "Default VPC is in use for workloads.",
      };
    },
  },
  {
    checkId: "NET-005",
    service: "networking",
    title: "Network ACLs should not allow all inbound traffic",
    description:
      "Verifies that Network ACLs do not permit all inbound traffic from any source.",
    rationale:
      "NACLs are a stateless second line of defense. A permissive NACL undermines subnet-level segmentation.",
    severity: "medium",
    iso27001Controls: "A.8.20 (Networks security), A.8.22 (Segregation of networks)",
    remediationGuidance:
      "Replace the wildcard rule with explicit allow entries for required ephemeral and service ports.",
    remediationEffort: "medium",
    evaluationLogic: "Read NACL config; fail if any inbound entry has cidr `0.0.0.0/0` and action `allow` on all ports.",
    appliesTo: ["aws_network_acl"],
    evaluate: (r) => {
      const entries = (r.config.entries as Array<Record<string, unknown>>) ?? [];
      const open = entries.find(
        (e) => e.cidr === "0.0.0.0/0" && e.action === "allow" && e.direction === "inbound"
      );
      return {
        result: open ? "fail" : "pass",
        evidence: {
          observed: open ? "Inbound allow-all NACL entry present" : "No inbound allow-all entry",
          expected: "No inbound NACL entry allowing all traffic",
          fields: { naclId: r.config.naclId, entries },
        },
        message: open ? "NACL allows all inbound traffic." : "NACL does not allow all inbound traffic.",
      };
    },
  },

  // ────────────────────────── Encryption ──────────────────────────
  {
    checkId: "ENC-001",
    service: "encryption",
    title: "KMS customer-managed keys should have annual rotation enabled",
    description:
      "Verifies that KMS CMKs have automatic annual key rotation enabled.",
    rationale:
      "Key rotation limits the volume of data protected by a single key version, reducing impact of key compromise.",
    severity: "medium",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 3.8 (Ensure rotation for customer created CMKs is enabled)",
    iso27001Controls: "A.8.24 (Use of cryptography), A.8.10 (Information deletion)",
    remediationGuidance:
      "Enable annual rotation on the CMK. For AWS-managed keys, rotation is automatic.",
    remediationEffort: "low",
    evaluationLogic: "Read KMS key config; fail if `keyRotationEnabled !== true`.",
    appliesTo: ["aws_kms_key"],
    evaluate: (r) => {
      const rotation = Boolean(r.config.keyRotationEnabled);
      return {
        result: rotation ? "pass" : "fail",
        evidence: {
          observed: `Key rotation: ${rotation ? "enabled" : "disabled"}`,
          expected: "Automatic annual key rotation enabled",
          fields: { keyId: r.config.keyId, keyRotationEnabled: rotation },
        },
        message: rotation ? "Key rotation is enabled." : "Key rotation is disabled.",
      };
    },
  },
  {
    checkId: "ENC-002",
    service: "encryption",
    title: "EBS volumes should be encrypted",
    description:
      "Verifies that every EBS volume is encrypted at rest.",
    rationale:
      "Unencrypted volumes expose data if the underlying media or snapshot is accessed outside the control plane.",
    severity: "high",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 3.1 (Ensure EBS volume encryption is enabled)",
    iso27001Controls: "A.8.24 (Use of cryptography), A.8.12 (Data leakage)",
    remediationGuidance:
      "Enable the account-level EBS encryption-by-default flag and migrate legacy volumes via encrypted snapshots.",
    remediationEffort: "medium",
    evaluationLogic: "Read EBS volume config; fail if `encrypted !== true`.",
    appliesTo: ["aws_ebs_volume"],
    evaluate: (r) => {
      const enc = Boolean(r.config.encrypted);
      return {
        result: enc ? "pass" : "fail",
        evidence: {
          observed: `Encrypted: ${enc ? "yes" : "no"}`,
          expected: "EBS volume encrypted at rest",
          fields: { volumeId: r.config.volumeId, encrypted: enc },
        },
        message: enc ? "Volume is encrypted." : "Volume is not encrypted.",
      };
    },
  },
  {
    checkId: "ENC-003",
    service: "encryption",
    title: "RDS instances should have storage encryption enabled",
    description:
      "Verifies that RDS database instances have encryption at rest enabled.",
    rationale:
      "Database snapshots inherit the encryption state of their source; unencrypted instances expose data at rest and in backups.",
    severity: "high",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 3.4 (Ensure RDS storage encryption is enabled)",
    iso27001Controls: "A.8.24 (Use of cryptography), A.8.12 (Data leakage)",
    remediationGuidance:
      "Create an encrypted read replica, promote it, and retire the unencrypted instance.",
    remediationEffort: "high",
    evaluationLogic: "Read RDS instance config; fail if `storageEncrypted !== true`.",
    appliesTo: ["aws_rds_instance"],
    evaluate: (r) => {
      const enc = Boolean(r.config.storageEncrypted);
      return {
        result: enc ? "pass" : "fail",
        evidence: {
          observed: `Storage encrypted: ${enc ? "yes" : "no"}`,
          expected: "RDS storage encryption enabled",
          fields: { dbInstanceIdentifier: r.config.dbInstanceIdentifier, storageEncrypted: enc },
        },
        message: enc ? "RDS instance is encrypted." : "RDS instance storage is not encrypted.",
      };
    },
  },
  {
    checkId: "ENC-004",
    service: "encryption",
    title: "S3 buckets should use SSE-KMS (customer-managed keys)",
    description:
      "Verifies that buckets holding sensitive data use KMS customer-managed keys rather than S3-managed encryption.",
    rationale:
      "SSE-KMS with a CMK enables key usage logging, separation of duties, and the ability to revoke access independently.",
    severity: "medium",
    iso27001Controls: "A.8.24 (Use of cryptography), A.8.2 (Privileged access rights)",
    remediationGuidance:
      "Switch default encryption from SSE-S3 to SSE-KMS with a CMK, and update key policies for least privilege.",
    remediationEffort: "medium",
    evaluationLogic: "Read bucket config; fail if `serverSideEncryption !== 'SSE-KMS'`.",
    appliesTo: ["aws_s3_bucket"],
    evaluate: (r) => {
      const sse = String(r.config.serverSideEncryption ?? "None");
      return {
        result: sse === "SSE-KMS" ? "pass" : "fail",
        evidence: {
          observed: `Encryption: ${sse}`,
          expected: "SSE-KMS with a customer-managed key",
          fields: { bucketName: r.config.bucketName, serverSideEncryption: sse },
        },
        message: sse === "SSE-KMS" ? "Bucket uses SSE-KMS." : `Bucket uses ${sse} instead of SSE-KMS.`,
      };
    },
  },

  // ──────────────────────── Logging & Monitoring ────────────────────────
  {
    checkId: "LOG-001",
    service: "logging",
    title: "CloudTrail should be enabled and multi-region",
    description:
      "Verifies that a multi-region management-events CloudTrail is active.",
    rationale:
      "Without a multi-region trail, management-plane activity in some regions is invisible to investigators.",
    severity: "critical",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 4.1 (Ensure CloudTrail is enabled in all regions)",
    iso27001Controls: "A.8.15 (Logging), A.8.16 (Monitoring activities)",
    remediationGuidance:
      "Create a multi-region trail with log file validation and SSE-KMS on the destination bucket.",
    remediationEffort: "low",
    evaluationLogic: "Read CloudTrail config; fail if `isMultiRegionTrail !== true`.",
    appliesTo: ["aws_cloudtrail"],
    evaluate: (r) => {
      const multi = Boolean(r.config.isMultiRegionTrail);
      const logging = Boolean(r.config.isLogging);
      return {
        result: multi && logging ? "pass" : "fail",
        evidence: {
          observed: `Multi-region: ${multi}, Logging: ${logging}`,
          expected: "A multi-region, logging CloudTrail",
          fields: { trailName: r.config.trailName, isMultiRegionTrail: multi, isLogging: logging },
        },
        message: multi && logging ? "Multi-region CloudTrail is active." : "CloudTrail is not multi-region or not logging.",
      };
    },
  },
  {
    checkId: "LOG-002",
    service: "logging",
    title: "CloudTrail log file validation should be enabled",
    description:
      "Verifies that log file integrity validation is enabled on the trail.",
    rationale:
      "Validation enables detection of tampered or deleted log files during an investigation.",
    severity: "medium",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 4.3 (Ensure CloudTrail log file validation is enabled)",
    iso27001Controls: "A.8.15 (Logging), A.8.12 (Data leakage)",
    remediationGuidance: "Enable log file validation on the existing trail.",
    remediationEffort: "low",
    evaluationLogic: "Read CloudTrail config; fail if `logFileValidationEnabled !== true`.",
    appliesTo: ["aws_cloudtrail"],
    evaluate: (r) => {
      const v = Boolean(r.config.logFileValidationEnabled);
      return {
        result: v ? "pass" : "fail",
        evidence: {
          observed: `Log file validation: ${v ? "enabled" : "disabled"}`,
          expected: "Log file validation enabled",
          fields: { trailName: r.config.trailName, logFileValidationEnabled: v },
        },
        message: v ? "Log file validation is enabled." : "Log file validation is disabled.",
      };
    },
  },
  {
    checkId: "LOG-003",
    service: "logging",
    title: "CloudTrail should deliver logs to CloudWatch Logs",
    description:
      "Verifies the trail is configured to stream events into a CloudWatch Logs log group.",
    rationale:
      "Streaming to CloudWatch Logs enables metric filters, alarms, and alerting on management-plane activity.",
    severity: "medium",
    cisBenchmark: "CIS AWS Foundations Benchmark v3.0 — 4.2 (Ensure CloudTrail trails are integrated with CloudWatch Logs)",
    iso27001Controls: "A.8.15 (Logging), A.8.16 (Monitoring activities)",
    remediationGuidance:
      "Configure the trail's CloudWatch Logs log group and role for delivery.",
    remediationEffort: "low",
    evaluationLogic: "Read CloudTrail config; fail if `cloudWatchLogsLogGroupArn` is empty.",
    appliesTo: ["aws_cloudtrail"],
    evaluate: (r) => {
      const group = String(r.config.cloudWatchLogsLogGroupArn ?? "");
      return {
        result: group ? "pass" : "fail",
        evidence: {
          observed: group ? `Delivering to ${group.split(":").slice(-1)[0]}` : "No CloudWatch Logs destination",
          expected: "CloudTrail delivering to a CloudWatch Logs log group",
          fields: { trailName: r.config.trailName, cloudWatchLogsLogGroupArn: group || null },
        },
        message: group ? "Trail delivers to CloudWatch Logs." : "Trail does not deliver to CloudWatch Logs.",
      };
    },
  },
  {
    checkId: "LOG-004",
    service: "logging",
    title: "CloudTrail S3 bucket should have access logging enabled",
    description:
      "Verifies that the bucket storing CloudTrail logs has its own access logging enabled.",
    rationale:
      "Logging access to the audit bucket creates a tamper-evident chain and deters log tampering.",
    severity: "low",
    iso27001Controls: "A.8.15 (Logging), A.8.16 (Monitoring activities)",
    remediationGuidance:
      "Enable server access logging on the CloudTrail destination bucket to a separate, restricted log bucket.",
    remediationEffort: "low",
    evaluationLogic: "Read CloudTrail config; fail if `s3BucketAccessLogging !== true`.",
    appliesTo: ["aws_cloudtrail"],
    evaluate: (r) => {
      const logging = Boolean(r.config.s3BucketAccessLogging);
      return {
        result: logging ? "pass" : "fail",
        evidence: {
          observed: `Trail bucket access logging: ${logging ? "enabled" : "disabled"}`,
          expected: "Access logging enabled on the trail destination bucket",
          fields: { trailName: r.config.trailName, s3BucketAccessLogging: logging },
        },
        message: logging ? "Trail bucket access logging is enabled." : "Trail bucket access logging is disabled.",
      };
    },
  },
  {
    checkId: "LOG-005",
    service: "logging",
    title: "AWS Config recorder should be enabled in all regions",
    description:
      "Verifies that the AWS Config configuration recorder is recording in every supported region.",
    rationale:
      "Config provides the resource configuration history that powers drift detection and compliance evaluation.",
    severity: "medium",
    iso27001Controls: "A.8.15 (Logging), A.8.9 (Configuration management)",
    remediationGuidance:
      "Enable the configuration recorder in all regions and deliver to a central logging account.",
    remediationEffort: "low",
    evaluationLogic: "Read Config recorder config; fail if `recording === false` or `allRegions !== true`.",
    appliesTo: ["aws_config_recorder"],
    evaluate: (r) => {
      const recording = Boolean(r.config.recording);
      const allRegions = Boolean(r.config.allRegions);
      return {
        result: recording && allRegions ? "pass" : "fail",
        evidence: {
          observed: `Recording: ${recording}, All regions: ${allRegions}`,
          expected: "Config recorder recording in all regions",
          fields: { recording, allRegions },
        },
        message: recording && allRegions ? "Config recorder is enabled in all regions." : "Config recorder is not enabled in all regions.",
      };
    },
  },
];

export const CHECK_BY_ID = new Map(SECURITY_CHECKS.map((c) => [c.checkId, c]));

export const SERVICE_LABELS: Record<string, string> = {
  iam: "Identity & Access",
  storage: "Storage",
  networking: "Networking",
  encryption: "Encryption",
  logging: "Logging & Monitoring",
};

export const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
};
