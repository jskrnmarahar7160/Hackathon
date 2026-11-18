# Sentinel CSPM — Cloud Security Posture & Compliance Monitoring

A read-only Cloud Security Posture Management (CSPM) platform built with Next.js 16,
TypeScript, Tailwind CSS, shadcn/ui, Prisma and Recharts.

It evaluates **authorized, read-only** cloud configuration data against a documented
set of security checks, maps findings to **CIS Benchmarks** and **ISO 27001:2022**
controls (for internal alignment only — _not_ a certification), assigns severity and
captures evidence for every failed check, and tracks remediation status and compliance
trends over time.

> **Read-only by design.** The platform holds credentials scoped to configuration-reading
> APIs only. It never mutates cloud resources. Status updates are tracked locally.

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Run locally](#run-locally)
5. [Deploy on the cloud for free](#deploy-on-the-cloud-for-free)
6. [API reference](#api-reference)
7. [Security checks library](#security-checks-library)
8. [Limitations & disclaimer](#limitations--disclaimer)

---

## Features

- **5-service assessment** — IAM, Storage, Networking, Encryption, Logging & Monitoring.
- **25 documented checks** — each with rationale, severity, evaluation logic, CIS + ISO 27001 mapping, and remediation guidance.
- **Evidence-backed findings** — observed vs. expected state plus raw resource config for every failure.
- **Dashboard** — weighted compliance score, severity distribution, remediation status, 35-day trend, posture-by-service.
- **Findings explorer** — filterable table + detail drawer with evidence, control mappings, and status management (open / in-progress / resolved / suppressed).
- **Checks library** — searchable catalog of every control with its mappings.
- **Resources inventory** — every assessed cloud resource grouped by service with finding counts.
- **Assessments** — run history + on-demand re-evaluation of the latest snapshot.
- **Reports** — downloadable **Evidence Pack** (machine-readable JSON) and **Assessment Report** (executive + technical summary).
- **Architecture docs** — read-only design, data model, scope & limitations.
- **Light/dark mode**, fully responsive, sticky footer.

---

## Tech stack

| Layer            | Choice                                            |
| ---------------- | ------------------------------------------------- |
| Framework        | Next.js 16 (App Router)                           |
| Language         | TypeScript 5                                     |
| Styling          | Tailwind CSS 4 + shadcn/ui (New York)            |
| Charts           | Recharts                                         |
| Database         | Prisma ORM + SQLite (local) / PostgreSQL (cloud) |
| State            | React hooks + fetch                              |
| Icons            | lucide-react                                     |
| Notifications     | sonner                                           |

---

## Project structure

```
my-project/
├── prisma/
│   └── schema.prisma              # CloudAccount, Resource, SecurityCheck, Finding, Remediation, Assessment, ComplianceSnapshot
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout, ThemeProvider, toasters
│   │   ├── page.tsx               # Renders <CspmApp /> (the only user route)
│   │   └── api/cspm/
│   │       ├── dashboard/route.ts           # Aggregated posture metrics
│   │       ├── findings/route.ts            # List findings w/ filters
│   │       ├── findings/[id]/route.ts       # PATCH remediation status
│   │       ├── checks/route.ts              # Security checks catalog
│   │       ├── resources/route.ts           # Resource inventory
│   │       ├── assessments/route.ts        # Assessment history
│   │       ├── assessments/run/route.ts     # POST — run a new assessment
│   │       ├── reports/evidence/route.ts    # Evidence pack JSON
│   │       └── reports/assessment/route.ts  # Assessment report JSON
│   ├── components/
│   │   ├── cspm/
│   │   │   ├── app-shell.tsx       # Header, tabs, footer, run-assessment button
│   │   │   ├── lib.ts             # Severity/status styles, service meta, formatters
│   │   │   ├── badges.tsx         # SeverityBadge / StatusBadge / ResultBadge
│   │   │   ├── stat-card.tsx      # StatCard + ScoreRing
│   │   │   ├── theme-toggle.tsx
│   │   │   └── views/
│   │   │       ├── overview.tsx          # Dashboard
│   │   │       ├── findings-view.tsx     # Findings table + detail sheet
│   │   │       ├── checks-view.tsx       # Checks library
│   │   │       ├── resources-view.tsx    # Resource inventory
│   │   │       ├── assessments-view.tsx  # Run history + run button
│   │   │       ├── reports-view.tsx       # Evidence pack + assessment report
│   │   │       └── architecture-view.tsx  # Read-only architecture docs
│   │   └── ui/                    # shadcn/ui primitives (preinstalled)
│   ├── lib/
│   │   ├── db.ts                  # PrismaClient singleton
│   │   ├── utils.ts               # cn() helper
│   │   └── cspm/
│   │       ├── types.ts           # Domain types
│   │       ├── checks.ts          # 25 documented security checks + evaluators
│   │       ├── snapshot.ts        # Sample read-only cloud config snapshot
│   │       ├── engine.ts         # runAssessment() + computeScore()
│   │       ├── report.ts         # Evidence pack + assessment report builders
│   │       └── seed.ts           # Seeds DB (run: bun run src/lib/cspm/seed.ts)
│   └── hooks/
├── package.json
├── next.config.ts
├── tsconfig.json
└── .env                           # DATABASE_URL
```

---

## Run locally

### Prerequisites

- **Node.js 20+** and **Bun** (recommended) — install Bun:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
  (You can also use `npm`/`pnpm` — just replace `bun` with your package manager.)

### Steps

```bash
# 1. Clone / unzip the project, then:
cd my-project

# 2. Install dependencies
bun install        # or: npm install

# 3. Configure the database URL (already set for SQLite by default)
#    .env contains:
#    DATABASE_URL="file:./db/custom.db"

# 4. Create the database schema
bun run db:push    # or: npx prisma db push

# 5. Seed sample data (cloud account, 25 checks, 24 resources, 58 findings, 7 trend snapshots)
bun run src/lib/cspm/seed.ts

# 6. Start the dev server
bun run dev        # or: npm run dev
```

Open **http://localhost:3000** in your browser.

### Useful scripts

| Script                  | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `bun run dev`           | Start Next.js dev server on port 3000                     |
| `bun run lint`          | Run ESLint                                                |
| `bun run db:push`       | Push Prisma schema to the DB (creates tables)            |
| `bun run db:generate`   | Regenerate the Prisma Client                              |
| `bun run db:reset`      | Drop & recreate the DB (then re-run seed)                 |
| `bun run src/lib/cspm/seed.ts` | Re-seed the sample data                            |
| `bun run build`         | Production build (standalone output)                     |

### Reset & re-seed

```bash
bun run db:reset    # wipes everything
bun run src/lib/cspm/seed.ts
```

---

## Deploy on the cloud for free

Two recommended paths. **Vercel + Neon** is the easiest for a Next.js app; **Render**
lets you keep SQLite if you want a single-service deploy.

### Option A — Vercel + Neon Postgres (recommended, fully free)

Vercel is the home of Next.js and has a generous free tier. SQLite (file-based) doesn't
persist across Vercel's serverless invocations, so we switch the database to **Neon
Postgres** (free tier: 0.5 GB, always-available, generous compute).

#### 1. Push the code to GitHub

```bash
git init && git add -A && git commit -m "Sentinel CSPM"
# Create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/sentinel-cspm.git
git branch -M main
git push -u origin main
```

#### 2. Create a free Neon database

1. Go to <https://neon.tech> → Sign up with GitHub.
2. **Create Project** → copy the **Connection string** (looks like
   `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).

#### 3. Switch Prisma from SQLite to PostgreSQL

Edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"          // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Then regenerate the client and push the schema:

```bash
bun run db:generate
DATABASE_URL="postgresql://...?sslmode=require" bun run db:push
```

#### 4. Import on Vercel

1. Go to <https://vercel.com/new> → import your GitHub repo.
2. **Framework preset:** Next.js (auto-detected).
3. **Build & Output Settings:** leave defaults (Vercel runs `next build`).
4. **Environment Variables:** add
   - `DATABASE_URL` = your Neon connection string
5. **Deploy.**

#### 5. Seed the cloud database (one-time)

After the first deploy, seed the cloud DB from your laptop:

```bash
DATABASE_URL="postgresql://...?sslmode=require" bun run db:push
DATABASE_URL="postgresql://...?sslmode=require" bun run src/lib/cspm/seed.ts
```

Your app is now live at `https://<project>.vercel.app`. Free tier covers
~100 GB bandwidth + 100 GB-hours serverless compute per month — plenty for a demo.

---

### Option B — Render (single web service, also fully free)

Render's free Web Service runs a long-lived Node process, so you can keep SQLite if
you like (data resets on service restart — fine for a demo) or use the Neon Postgres
path above for persistence.

1. Push code to GitHub (step 1 above).
2. On <https://render.com> → **New +** → **Web Service** → connect your repo.
3. Settings:
   - **Runtime:** Node (or Bun if available)
   - **Build command:** `npm install && npm run db:push && npx prisma generate && npm run src/lib/cspm/seed.ts && npm run build`
     (use `bunx` instead of `npx` if you selected Bun)
   - **Start command:** `npm run start`
   - **Environment variables:** `DATABASE_URL="file:./db/custom.db"` (SQLite, ephemeral)
     — or your Neon string for persistence.
4. **Create Web Service** (free tier — service sleeps after 15 min idle, wakes on request).

---

### Option C — Fly.io (free allowance, persistent SQLite volume)

Fly.io gives a small always-free allowance and supports persistent volumes, so SQLite
works across restarts.

1. Install `flyctl`: <https://fly.io/docs/hands-on/install-flyctl/>
2. `fly launch` (auto-detects Next.js) — answer Yes to create a Postgres cluster, or
   attach a 1 GB persistent volume and keep SQLite.
3. `fly secrets set DATABASE_URL="..."` if you switched to Postgres.
4. `fly deploy` — then `fly ssh console -C "node src/lib/cspm/seed.ts"` to seed.

---

## API reference

All routes are under `/api/cspm` and return JSON.

| Method | Route                          | Purpose                                             |
| ------ | ------------------------------ | --------------------------------------------------- |
| GET    | `/api/cspm/dashboard`          | Aggregated posture metrics + trend                  |
| GET    | `/api/cspm/findings`           | List findings (`?service=&severity=&status=&q=`)    |
| PATCH  | `/api/cspm/findings/[id]`      | Update remediation status `{status, note?}`         |
| GET    | `/api/cspm/checks`             | Security checks catalog                             |
| GET    | `/api/cspm/resources`          | Resource inventory grouped by service               |
| GET    | `/api/cspm/assessments`        | Assessment run history                              |
| POST   | `/api/cspm/assessments/run`    | Run a new assessment against the latest snapshot   |
| GET    | `/api/cspm/reports/evidence`   | Evidence pack (`?download=1` for file download)     |
| GET    | `/api/cspm/reports/assessment` | Assessment report (`?download=1` for file download)|

---

## Security checks library

25 checks across 5 services, each mapped to a CIS Benchmark reference and ISO 27001:2022
Annex A controls. Full definitions live in `src/lib/cspm/checks.ts`.

| ID        | Service   | Title                                                        | Severity | CIS ref |
| --------- | --------- | ----------------------------------------------------------- | -------- | ------- |
| IAM-001   | iam       | Root account MFA should be enabled                          | critical | 1.1     |
| IAM-002   | iam       | Root account must not have active access keys               | critical | 1.4     |
| IAM-003   | iam       | MFA for IAM users with console access                       | high     | 1.4     |
| IAM-004   | iam       | Access keys rotated within 90 days                          | medium   | 1.11    |
| IAM-005   | iam       | Password policy minimum length 14                           | medium   | 1.5     |
| IAM-006   | iam       | Unused credentials disabled                                  | low      | 1.3     |
| STO-001   | storage   | S3 buckets not publicly accessible                          | critical | 2.1.1   |
| STO-002   | storage   | S3 default encryption enabled                                | high     | 2.1.2   |
| STO-003   | storage   | S3 versioning enabled                                        | medium   | 2.1.3   |
| STO-004   | storage   | S3 Block Public Access enabled                               | high     | —       |
| STO-005   | storage   | S3 server access logging                                     | low      | 2.1.4   |
| NET-001   | networking| No SSH (22) from 0.0.0.0/0                                   | high     | 4.1     |
| NET-002   | networking| No RDP (3389) from 0.0.0.0/0                                 | critical | 4.2     |
| NET-003   | networking| No all-port inbound                                          | high     | —       |
| NET-004   | networking| Default VPC not used for production                          | medium   | —       |
| NET-005   | networking| NACL not all-inbound                                         | medium   | —       |
| ENC-001   | encryption| KMS CMK annual rotation                                      | medium   | 3.8     |
| ENC-002   | encryption| EBS volumes encrypted                                        | high     | 3.1     |
| ENC-003   | encryption| RDS storage encrypted                                        | high     | 3.4     |
| ENC-004   | encryption| S3 uses SSE-KMS (customer-managed keys)                     | medium   | —       |
| LOG-001   | logging   | CloudTrail enabled and multi-region                         | critical | 4.1     |
| LOG-002   | logging   | CloudTrail log file validation                              | medium   | 4.3     |
| LOG-003   | logging   | CloudTrail → CloudWatch Logs                                 | medium   | 4.2     |
| LOG-004   | logging   | CloudTrail S3 bucket access logging                          | low      | —       |
| LOG-005   | logging   | AWS Config recorder enabled in all regions                   | medium   | —       |

---

## Limitations & disclaimer

- **Point-in-time, not real-time.** Assessments reflect the snapshot captured during the
  last authorized read sync. Drift between scans is not detected until the next run.
- **Scope limited to five services.** IAM, Storage, Networking, Encryption, Logging.
- **Mapping is not certification.** CIS / ISO 27001 references support internal alignment
  and traceability only — they do not constitute a formal audit or compliance attestation.
- **Remediation is tracked, not executed.** The platform records status changes for
  reporting; actual remediation is performed by authorized operators in the cloud account.
- **Read-only credentials enforced.** Scoped to read APIs — even if compromised, the
  platform cannot modify cloud resources.
- **Evidence accuracy depends on the source.** Findings rely on the accuracy of the
  configuration data returned by the cloud provider's read APIs.

> This is a CSPM prototype for internal use. It is not a substitute for a formal audit
> or compliance attestation.
