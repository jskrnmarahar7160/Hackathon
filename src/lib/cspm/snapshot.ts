// Sample cloud configuration snapshot captured in READ-ONLY mode.
//
// This dataset represents the kind of configuration data the platform would
// collect from authorized cloud APIs (e.g. IAM GetAccountSummary, S3
// GetBucketEncryption, EC2 DescribeSecurityGroups). It intentionally contains
// a mix of compliant and non-compliant resources so the assessment engine can
// produce a realistic findings set across all five services and severities.
//
// No credentials are stored and no write operations are ever performed.

import type { ResourceConfig } from "./types";

export const SAMPLE_ACCOUNT = {
  provider: "aws" as const,
  accountId: "867251904213",
  displayName: "Northwind Production AWS",
  region: "us-east-1",
};

export const SAMPLE_SNAPSHOT: ResourceConfig[] = [
  // ───────── IAM ─────────
  {
    id: "snap-iam-root",
    service: "iam",
    resourceType: "aws_iam_root",
    name: "root",
    arn: "arn:aws:iam::867251904213:root",
    criticality: "critical",
    internetFacing: false,
    config: {
      accountId: "867251904213",
      mfaEnabled: false, // FAIL IAM-001
      activeAccessKeys: 1, // FAIL IAM-002
    },
  },
  {
    id: "snap-iam-pwpolicy",
    service: "iam",
    resourceType: "aws_iam_password_policy",
    name: "account-password-policy",
    criticality: "high",
    internetFacing: false,
    config: {
      minimumPasswordLength: 8, // FAIL IAM-005
      requireSymbols: true,
      requireNumbers: true,
      requireUppercase: true,
      requireLowercase: true,
      maxPasswordAge: 90,
      passwordReusePrevention: 3,
    },
  },
  {
    id: "snap-iam-user-appadmin",
    service: "iam",
    resourceType: "aws_iam_user",
    name: "app-admin",
    arn: "arn:aws:iam::867251904213:user/app-admin",
    criticality: "high",
    internetFacing: false,
    config: {
      userName: "app-admin",
      consoleAccess: true,
      mfaEnabled: false, // FAIL IAM-003
      lastUsedDays: 5,
      accessKeys: [],
    },
  },
  {
    id: "snap-iam-user-cibot",
    service: "iam",
    resourceType: "aws_iam_user",
    name: "ci-bot",
    arn: "arn:aws:iam::867251904213:user/ci-bot",
    criticality: "medium",
    internetFacing: false,
    config: {
      userName: "ci-bot",
      consoleAccess: false,
      mfaEnabled: false,
      lastUsedDays: 2,
      accessKeys: [
        {
          accessKeyId: "AKIAZ7Q2CIBOT01",
          status: "Active",
          createdAt: "2025-01-12",
          lastRotatedAt: "2025-01-12", // ~140 days ago → FAIL IAM-004
        },
      ],
    },
  },
  {
    id: "snap-iam-user-former",
    service: "iam",
    resourceType: "aws_iam_user",
    name: "former-contractor",
    arn: "arn:aws:iam::867251904213:user/former-contractor",
    criticality: "medium",
    internetFacing: false,
    config: {
      userName: "former-contractor",
      consoleAccess: true,
      mfaEnabled: true,
      lastUsedDays: 95, // FAIL IAM-006
      accessKeys: [],
    },
  },
  {
    id: "snap-iam-user-secops",
    service: "iam",
    resourceType: "aws_iam_user",
    name: "secops-analyst",
    arn: "arn:aws:iam::867251904213:user/secops-analyst",
    criticality: "high",
    internetFacing: false,
    config: {
      userName: "secops-analyst",
      consoleAccess: true,
      mfaEnabled: true, // PASS IAM-003
      lastUsedDays: 1,
      accessKeys: [],
    },
  },

  // ───────── Storage ─────────
  {
    id: "snap-s3-public",
    service: "storage",
    resourceType: "aws_s3_bucket",
    name: "northwind-public-assets",
    region: "us-east-1",
    arn: "arn:aws:s3:::northwind-public-assets",
    criticality: "critical",
    internetFacing: true,
    config: {
      bucketName: "northwind-public-assets",
      acl: [
        { grantee: "AllUsers", permission: "READ" }, // FAIL STO-001
      ],
      serverSideEncryption: null, // FAIL STO-002 & STO-004
      versioning: "Suspended", // FAIL STO-003
      blockPublicAccess: false, // FAIL STO-004
      accessLogging: false, // FAIL STO-005
    },
  },
  {
    id: "snap-s3-datalake",
    service: "storage",
    resourceType: "aws_s3_bucket",
    name: "northwind-data-lake",
    region: "us-east-1",
    arn: "arn:aws:s3:::northwind-data-lake",
    criticality: "critical",
    internetFacing: false,
    config: {
      bucketName: "northwind-data-lake",
      acl: [],
      serverSideEncryption: "SSE-KMS", // PASS STO-002 & STO-004
      versioning: "Enabled", // PASS STO-003
      blockPublicAccess: true, // PASS STO-004
      accessLogging: false, // FAIL STO-005
    },
  },
  {
    id: "snap-s3-archive",
    service: "storage",
    resourceType: "aws_s3_bucket",
    name: "northwind-compliance-archive",
    region: "us-east-1",
    arn: "arn:aws:s3:::northwind-compliance-archive",
    criticality: "high",
    internetFacing: false,
    config: {
      bucketName: "northwind-compliance-archive",
      acl: [],
      serverSideEncryption: "SSE-KMS",
      versioning: "Enabled",
      blockPublicAccess: true,
      accessLogging: true, // PASS STO-005
    },
  },

  // ───────── Networking ─────────
  {
    id: "snap-sg-ssh",
    service: "networking",
    resourceType: "aws_security_group",
    name: "launch-wizard-1",
    region: "us-east-1",
    criticality: "high",
    internetFacing: true,
    config: {
      groupName: "launch-wizard-1",
      ingressRules: [
        { cidr: "0.0.0.0/0", fromPort: "22", toPort: "22", protocol: "tcp" }, // FAIL NET-001
      ],
    },
  },
  {
    id: "snap-sg-rdp",
    service: "networking",
    resourceType: "aws_security_group",
    name: "rdp-bastion-sg",
    region: "us-east-1",
    criticality: "critical",
    internetFacing: true,
    config: {
      groupName: "rdp-bastion-sg",
      ingressRules: [
        { cidr: "0.0.0.0/0", fromPort: "3389", toPort: "3389", protocol: "tcp" }, // FAIL NET-002
      ],
    },
  },
  {
    id: "snap-sg-allopen",
    service: "networking",
    resourceType: "aws_security_group",
    name: "all-open-sg",
    region: "us-east-1",
    criticality: "high",
    internetFacing: true,
    config: {
      groupName: "all-open-sg",
      ingressRules: [
        { cidr: "0.0.0.0/0", fromPort: "0", toPort: "65535", protocol: "-1" }, // FAIL NET-003
      ],
    },
  },
  {
    id: "snap-sg-webtier",
    service: "networking",
    resourceType: "aws_security_group",
    name: "web-tier-sg",
    region: "us-east-1",
    criticality: "medium",
    internetFacing: true,
    config: {
      groupName: "web-tier-sg",
      ingressRules: [
        { cidr: "10.0.0.0/16", fromPort: "443", toPort: "443", protocol: "tcp" }, // PASS
        { cidr: "10.0.0.0/16", fromPort: "80", toPort: "80", protocol: "tcp" }, // PASS
      ],
    },
  },
  {
    id: "snap-vpc-default",
    service: "networking",
    resourceType: "aws_vpc",
    name: "vpc-default",
    region: "us-east-1",
    criticality: "medium",
    internetFacing: false,
    config: {
      vpcId: "vpc-0a1b2c3d",
      isDefault: true, // FAIL NET-004
      inUse: true,
    },
  },
  {
    id: "snap-vpc-prod",
    service: "networking",
    resourceType: "aws_vpc",
    name: "vpc-prod",
    region: "us-east-1",
    criticality: "critical",
    internetFacing: false,
    config: {
      vpcId: "vpc-0e9f8a7b",
      isDefault: false,
      inUse: true,
    },
  },
  {
    id: "snap-nacl-default",
    service: "networking",
    resourceType: "aws_network_acl",
    name: "acl-default",
    region: "us-east-1",
    criticality: "medium",
    internetFacing: false,
    config: {
      naclId: "acl-5f6e7d8c",
      entries: [
        { cidr: "0.0.0.0/0", action: "allow", direction: "inbound", fromPort: "0", toPort: "65535" }, // FAIL NET-005
      ],
    },
  },

  // ───────── Encryption ─────────
  {
    id: "snap-kms-appkey",
    service: "encryption",
    resourceType: "aws_kms_key",
    name: "alias/app-data-key",
    region: "us-east-1",
    arn: "arn:aws:kms:us-east-1:867251904213:key/abcd-1111-2222-3333",
    criticality: "high",
    internetFacing: false,
    config: {
      keyId: "abcd-1111-2222-3333",
      keyRotationEnabled: true, // PASS ENC-001
    },
  },
  {
    id: "snap-kms-legacy",
    service: "encryption",
    resourceType: "aws_kms_key",
    name: "alias/legacy-key",
    region: "us-east-1",
    arn: "arn:aws:kms:us-east-1:867251904213:key/efgh-4444-5555-6666",
    criticality: "medium",
    internetFacing: false,
    config: {
      keyId: "efgh-4444-5555-6666",
      keyRotationEnabled: false, // FAIL ENC-001
    },
  },
  {
    id: "snap-ebs-vol-unenc",
    service: "encryption",
    resourceType: "aws_ebs_volume",
    name: "vol-0a1b2c3d4e5f0001",
    region: "us-east-1",
    arn: "arn:aws:ec2:us-east-1:867251904213:volume/vol-0a1b2c3d4e5f0001",
    criticality: "high",
    internetFacing: false,
    config: {
      volumeId: "vol-0a1b2c3d4e5f0001",
      encrypted: false, // FAIL ENC-002
    },
  },
  {
    id: "snap-ebs-vol-enc",
    service: "encryption",
    resourceType: "aws_ebs_volume",
    name: "vol-0a1b2c3d4e5f0002",
    region: "us-east-1",
    arn: "arn:aws:ec2:us-east-1:867251904213:volume/vol-0a1b2c3d4e5f0002",
    criticality: "high",
    internetFacing: false,
    config: {
      volumeId: "vol-0a1b2c3d4e5f0002",
      encrypted: true, // PASS ENC-002
    },
  },
  {
    id: "snap-rds-prod",
    service: "encryption",
    resourceType: "aws_rds_instance",
    name: "prod-db",
    region: "us-east-1",
    arn: "arn:aws:rds:us-east-1:867251904213:db:prod-db",
    criticality: "critical",
    internetFacing: false,
    config: {
      dbInstanceIdentifier: "prod-db",
      storageEncrypted: true, // PASS ENC-003
    },
  },
  {
    id: "snap-rds-staging",
    service: "encryption",
    resourceType: "aws_rds_instance",
    name: "staging-db",
    region: "us-east-1",
    arn: "arn:aws:rds:us-east-1:867251904213:db:staging-db",
    criticality: "high",
    internetFacing: false,
    config: {
      dbInstanceIdentifier: "staging-db",
      storageEncrypted: false, // FAIL ENC-003
    },
  },

  // ───────── Logging ─────────
  {
    id: "snap-cloudtrail",
    service: "logging",
    resourceType: "aws_cloudtrail",
    name: "management-events",
    region: "us-east-1",
    arn: "arn:aws:cloudtrail:us-east-1:867251904213:trail/management-events",
    criticality: "critical",
    internetFacing: false,
    config: {
      trailName: "management-events",
      isMultiRegionTrail: false, // FAIL LOG-001
      isLogging: true,
      logFileValidationEnabled: true, // PASS LOG-002
      cloudWatchLogsLogGroupArn: "", // FAIL LOG-003
      s3BucketAccessLogging: false, // FAIL LOG-004
    },
  },
  {
    id: "snap-config",
    service: "logging",
    resourceType: "aws_config_recorder",
    name: "ConfigRecorder",
    region: "us-east-1",
    criticality: "high",
    internetFacing: false,
    config: {
      recording: false, // FAIL LOG-005
      allRegions: false,
    },
  },
];
