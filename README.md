~# SmartSociety

**Smart Society Management System** — a web-based platform that centralises
housing-society administration, gate security, maintenance billing, complaint
resolution and community engagement behind role-based interfaces for
administrators, residents, security guards and maintenance staff.

Built against the *Full-Stack Application Development* Software Requirements
Specification.

## 🌐 Live Demo

**https://smartsocietyhub.vercel.app**

Hosted live with a seeded demo database — sign in with any of the demo
accounts below (or the one-click buttons on the sign-in page).

```bash
npm install
npm run setup     # creates .env, starts PostgreSQL, migrates and seeds
npm run dev       # http://localhost:3000
```

No PostgreSQL installed? You do not need to install one — `npm run setup` starts
a real PostgreSQL 17 server from bundled binaries in a project-local directory.

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Demo credentials](#demo-credentials)
- [Commands](#commands)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Assumptions](#assumptions)
- [Known limitations](#known-limitations)

---

## Overview

Housing societies still run on paper gate registers, WhatsApp complaint threads
and spreadsheet billing. That produces unverifiable visitor entries, complaints
with no owner or deadline, untracked dues, and no record to consult when
something is disputed.

SmartSociety replaces all of it with one auditable system:

| Role | What they get |
|---|---|
| **Administrator** | Resident and flat management, monthly billing with penalties, helpdesk routing with SLA monitoring, gate-log oversight, notices, polls, emergency broadcasts, an immutable audit trail and operational reports |
| **Resident** | Bills with a full charge breakdown and PDF receipts, QR visitor gate passes, complaints with photo uploads and SLA tracking, amenity booking, notices, polls, guidelines and emergency contacts |
| **Security Guard** | A tablet-first gate console: verify a QR or 6-digit code in milliseconds, log walk-ins, record exits, act on overstays, look up a vehicle |
| **Maintenance Staff** | A queue ordered by service-level deadline, with status updates, public and internal work notes and resolution tracking |

**55 screens · 4 roles · 27 database tables · 180 automated tests**

---

## Features

### Visitor management & QR gate passes

Residents pre-approve guests, delivery drivers, cabs and vendors with a
time-boxed pass carrying a QR code **and** a 6-digit numeric gate code for when a
camera is unusable. The guard console resolves either in about 15 ms and returns
a plain-language decision — including exactly why entry is refused. Verification
never consumes an entry; that is a separate confirmation, so an accidental scan
costs nothing.

Handled: expiry, cancellation, multi-entry passes for recurring vendors,
duplicate-scan prevention while a visitor is still inside, refusal with a
recorded reason, and overstay detection that notifies the host flat and the
committee.

### Maintenance billing & collection

One itemised invoice per occupied flat per month — maintenance, water, security,
common electricity, repairs, sinking fund — with a configurable late-payment
penalty and grace period. A flat can never be billed twice for the same period
(a database constraint), so re-running a cycle is safe. Payments produce a real
receipt number, transaction reference and downloadable PDF.

> Gateway processing and bank reconciliation are **simulated**, exactly as the
> specification scopes them. Every payment row is flagged `simulated = true` and
> the interface says so rather than pretending a charge occurred.

### Helpdesk with SLA tracking

Categorised tickets with photo uploads, priorities that set a response target
(4 / 12 / 48 / 96 hours), assignment ranked by department match and current
workload, a shared status timeline, internal notes that stay within the
maintenance team, and a resident satisfaction rating.

### Amenity booking

Live slot grids per facility per day. Double-booking is impossible: a composite
unique index enforces one confirmed booking per slot, and overlapping multi-slot
ranges are caught inside a serializable transaction. Approval workflows,
cancellation windows and per-slot fees are all configurable.

### Notices, polls & emergency alerts

Scheduled announcements with audience targeting, event calendars, and community
polls where one vote per resident is guaranteed by a unique database constraint —
not merely by application logic. Emergency broadcasts reach every signed-in
device as a full-width banner with an optional Web Audio siren.

### Security & auditing

Two-layer route protection, server-side authorisation on every page and action,
ownership-scoped queries, magic-byte validation on uploads, authenticated file
serving, rate limiting on sensitive paths, and an append-only audit log covering
gate entries, complaint status changes and administrative financial edits.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, server components, server actions) |
| Language | TypeScript 5 (strict) |
| UI | React 19 · Tailwind CSS 4 · Radix UI primitives · Lucide icons |
| Charts | Recharts |
| Database | PostgreSQL 17 (14+ supported) |
| ORM | Prisma 6 |
| Auth | bcrypt + signed HTTP-only JWT cookie backed by a revocable session row (jose) |
| Validation | Zod, at every server boundary |
| PDF | pdf-lib (pure JS — no headless browser) |
| QR | `qrcode` for generation · `@zxing/browser` for camera scanning |
| Testing | Vitest (unit + integration against a real database) · Playwright (E2E) |

Every choice is one the SRS §1.8.2 permits. The rationale for each is in
[docs/architecture.md](./docs/architecture.md#35-technology-decisions).

---

## Architecture

```
Browser
   │
   ├─ middleware.ts ............ edge: JWT check + route-role map
   │
   ├─ app/ .................... pages (server components) & route handlers
   ├─ actions/ ................ server actions: authn → authz → validate → audit
   ├─ services/ ............... domain logic, transactions, invariants
   ├─ lib/ .................... auth · rbac · validation · audit · notifications
   │
   └─ PostgreSQL (Prisma)
```

The important decision: **authorisation lives in the entry-point layer, not the
UI.** Hiding a button is a convenience; the action behind it is the security
boundary. Every server action begins with a `requireRole()` call, and every
ownership check re-queries with the caller's own identifier in the `where`
clause — so a forged request returns "not found" rather than someone else's
record.

The second: **invariants live in the domain layer, and where possible in the
database.** "One vote per resident" and "one booking per slot" are unique
indexes, so they hold even if application code is bypassed. The integration
tests prove this by writing directly to the database.

Full detail: [docs/architecture.md](./docs/architecture.md).

---

## Getting started

### Requirements

- Node.js 18.18+ (20 or 22 recommended)
- npm 9+
- PostgreSQL 14+ — **optional**, see below

### Quick start

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` creates `.env` with a freshly generated `AUTH_SECRET`, starts the
bundled PostgreSQL server, applies migrations and seeds realistic demo data.

### Manual setup

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET

node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

npm run db:up                 # or point DATABASE_URL at your own PostgreSQL
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `AUTH_SECRET` | **Yes** | — | Session signing key (≥ 32 characters) |
| `AUTH_SESSION_TTL` | No | `28800` | Session lifetime in seconds |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public base URL |
| `NEXT_PUBLIC_SOCIETY_NAME` | No | `Green Meadows Residency` | Society name in the UI |
| `UPLOAD_DIR` | No | `uploads` | Where complaint photos are written |
| `UPLOAD_MAX_BYTES` | No | `5242880` | Maximum upload size |

The application refuses to start with a missing `DATABASE_URL` or a short
`AUTH_SECRET`, rather than running insecurely.

### Using the plain SQL script

`database/schema.sql` is generated from the migration history:

```bash
createdb smartsociety
psql -d smartsociety -f database/schema.sql
npm run db:seed
```

---

## Demo credentials

Created by `npm run db:seed`, and listed on the sign-in page where one click
fills the form.

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@smartsociety.local` | `Admin@12345` |
| **Resident** | `resident@smartsociety.local` | `Resident@12345` |
| **Security Guard** | `guard@smartsociety.local` | `Guard@12345` |
| **Maintenance Staff** | `maintenance@smartsociety.local` | `Maintenance@12345` |

All other seeded accounts (a second administrator, two more guards, five more
technicians, 41 more residents) use **`Society@12345`**.

> Demonstration accounts for a locally-seeded database. Remove them before any
> real deployment.

### What the seed contains

4 towers · 48 flats · 42 residents · 9 staff · 6 amenities · 48 bookings ·
190 invoices across 5 months · 153 payments · 28 complaints across every status ·
78 visitors · 52 gate passes · 70 gate logs · 10 notices · 4 polls with 82 votes ·
3 resolved emergency alerts · a populated audit log.

Every dashboard, chart and list therefore shows real data.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run setup` | One-shot local setup |
| `npm run db:up` / `db:down` | Start / stop the bundled PostgreSQL |
| `npm run db:migrate` / `db:deploy` | Create / apply migrations |
| `npm run db:seed` / `db:reset` | Seed / reset and reseed |
| `npm run db:studio` | Browse the database |
| `npm run db:sql` | Regenerate `database/schema.sql` |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit + integration tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run verify` | typecheck + lint + tests |
| `npm run check:pages` | Request all 55 authenticated routes, reporting status and timing |

---

## Project structure

```
smartsociety/
├── app/                    Routes (Next.js App Router)
│   ├── page.tsx            Landing page — includes the required sitemap
│   ├── sitemap/            Full-page sitemap
│   ├── login/              Sign-in
│   ├── admin/              Administrator console  (16 routes)
│   ├── resident/           Resident portal        (17 routes)
│   ├── guard/              Gate console           (8 routes)
│   ├── staff/              Maintenance console    (5 routes)
│   ├── account/            Shared account pages   (3 routes)
│   └── api/                PDF, authenticated files, notification polling
│
├── actions/                Server actions — the write entry points
├── services/               Domain logic and invariants
├── lib/                    auth · rbac · validations · audit · notifications · utils
├── components/
│   ├── ui/                 Design-system primitives
│   ├── shared/             Composite building blocks
│   ├── layout/             App shell, navigation, emergency banner
│   ├── charts/             Recharts wrappers
│   └── marketing/          Landing-page sections
│
├── hooks/                  Client hooks
├── prisma/                 schema.prisma · migrations · seed.ts
├── database/               schema.sql (generated SQL deliverable)
├── scripts/                Local database, setup, SQL export, route check
├── tests/                  unit · integration · e2e
├── docs/                   Full project documentation
└── uploads/                Runtime complaint photos (git-ignored)
```

---

## Testing

```bash
npm test                          # 150 unit + integration tests
npx playwright install chromium   # first time only
npm run test:e2e                  # 30 end-to-end tests
```

| Layer | Count | Runs against |
|---|---|---|
| Unit | 45 | Pure functions — formatting, validation, RBAC, QR parsing, SLA |
| Integration | 105 | A **real** PostgreSQL database, so the constraints that enforce the business rules are genuinely exercised |
| End-to-end | 30 | The running application in Chromium, against the seeded demo data |

The integration tests use a real database on purpose. Requirements like "a
resident must not be able to vote twice" are enforced by unique indexes, and one
test bypasses the service layer entirely to prove the database rejects a
duplicate.

The end-to-end suite signs in once per role and reuses the session. The first
version signed in on every test and started failing against a production build —
it was tripping the application's own sign-in rate limit. The tests were changed
to behave like a real user rather than the limit being relaxed to suit them.

Full test-case tables are in [docs/testing.md](./docs/testing.md).

---

## Deployment

```bash
npm run build
npm start
```

Before deploying: set a strong `AUTH_SECRET`, point `DATABASE_URL` at a managed
PostgreSQL instance, run `npx prisma migrate deploy`, terminate TLS in front of
the app, give `uploads/` persistent storage, and **do not seed demo accounts into
production**.

See [docs/installation.md §12.7](./docs/installation.md#127-production-build) for
platform-specific notes and a Dockerfile.

---

## Documentation

Complete documentation lives in [`docs/`](./docs/README.md):

| Document | Covers |
|---|---|
| [Problem definition](./docs/problem-definition.md) | Background, solution, scope, constraints |
| [Requirements](./docs/requirements.md) | Every functional and non-functional requirement, traced to code |
| [Architecture](./docs/architecture.md) | Layering, request lifecycle, technology decisions |
| [Database design](./docs/database-design.md) | Schema, data dictionary, keys, indexes, constraints |
| [ER diagram](./docs/er-diagram.md) | Entity relationships |
| [Data flow diagrams](./docs/dfd.md) | Levels 0, 1 and 2 |
| [Use cases](./docs/use-cases.md) | Use-case diagram and specifications |
| [Workflows](./docs/workflows.md) | Activity diagrams for every major process |
| [Sitemap](./docs/sitemap.md) | Complete route map |
| [API reference](./docs/api.md) | Server actions and route handlers |
| [Testing](./docs/testing.md) | Strategy, test cases, test data |
| [Installation](./docs/installation.md) | Setup, environment, deployment, troubleshooting |
| [User guide](./docs/user-guide.md) | Step-by-step guide per role |
| [Assumptions](./docs/assumptions.md) | Decisions taken where the SRS was silent |
| [SRS compliance](./docs/SRS-COMPLIANCE.md) | Requirement-by-requirement checklist |

All diagrams are Mermaid, so they render on GitHub and stay editable as text.

---

## Assumptions

Where the SRS was silent, these decisions were taken. Each is explained in full
in [docs/assumptions.md](./docs/assumptions.md).

| # | Assumption |
|---|---|
| A-1 | "Multi-factor support" is read as *architected for a second factor*; single-factor with lockout, rate limiting and revocable sessions ships. **This is the one requirement not fully met.** |
| A-2 | The visitor photograph is modelled and displayed; live capture at the gate needs hardware outside a browser's scope |
| A-3 | Payment simulation is faithful — real receipt, reference and PDF, flagged `simulated`, with no money movement |
| A-4 | Uploads are stored on the local filesystem and served through an authenticated route, never from `public/` |
| A-5 | "Notifications" means in-app notifications; the model carries everything an SMS or email adapter would need |
| A-6 | Polling (45 s / 30 s, paused on hidden tabs) satisfies "real-time"; gate verification is synchronous and does not depend on it |
| A-7 | Housekeeping runs opportunistically on page load rather than in a separate scheduler that could fail silently |
| A-8 | One society per deployment, but the schema is rooted at `Society` so multi-tenancy is a scoping change |
| A-9 | Pakistani Rupees, `en-PK` formatting, Pakistani mobile and vehicle formats |
| A-10 | Monthly billing, 15th due date, 2% penalty after a 5-day grace period — all configurable in Settings |
| A-11 | SLA targets of 4 / 12 / 48 / 96 hours by priority |
| A-12 | The emergency siren is offered as an explicit control, because browsers block autoplaying audio |
| A-13 | Two gates: Main Gate and Service Gate |
| A-14 | Passwords: 8+ characters with upper, lower and a digit; no forced rotation |
| A-15 | 8-hour sessions, matching a guard's shift |
| A-16 | Nothing financial or security-related is ever hard-deleted |

---

## Known limitations

Stated plainly rather than left to be discovered:

- **Rate limiting is in-process.** Behind a multi-instance load balancer the
  effective limit would multiply. Redis is the standard fix; the module has one
  small interface.
- **No background job runner.** Housekeeping runs on page load, so a derived
  status (such as "overdue") can lag if nobody opens a dashboard for a long
  period. The underlying dates are always correct.
- **Uploads need object storage** on platforms with an ephemeral filesystem.
- **End-to-end tests run on Chromium only.** Firefox and Safari were checked by
  hand; the app uses no browser-specific APIs, and QR scanning degrades to
  keypad entry.
- **No visual regression, load or automated accessibility testing.** Responsive
  layouts and accessibility were verified manually.
- **Demo credentials are documented** because the SRS requires them as a
  deliverable. Remove them before any real deployment.
- **No demonstration video.** The SRS marks a `.mp4` walkthrough as mandatory;
  it is a screen recording of a person using the application and cannot be
  produced from source. The [user guide](./docs/user-guide.md) is written to
  serve as the recording script, and
  [SRS-COMPLIANCE.md](./docs/SRS-COMPLIANCE.md#-demonstration-video-19) suggests
  a shot order.

---

## Licence

Built for academic evaluation against the *Full-Stack Application Development*
Software Requirements Specification.
