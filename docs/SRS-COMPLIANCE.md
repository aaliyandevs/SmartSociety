# 15. SRS Compliance Checklist

Every requirement in *Software Requirements Specification — Smart Society
Management (Full-Stack Application Development)*, checked against what was
built.

**Legend:** ✅ Implemented · ⚠️ Partially implemented · ❌ Not implemented

---

## Summary

| Section | Requirements | ✅ | ⚠️ | ❌ |
|---|---|---|---|---|
| §1.4 Scope | 12 | 12 | 0 | 0 |
| §1.5 Constraints | 3 | 3 | 0 | 0 |
| §1.6 Functional — Residents | 6 | 5 | 1 | 0 |
| §1.6 Functional — Security | 3 | 3 | 0 | 0 |
| §1.6 Functional — Administration | 4 | 4 | 0 | 0 |
| §1.6 Common features & journeys | 5 | 5 | 0 | 0 |
| §1.7 Non-functional | 8 | 8 | 0 | 0 |
| §1.8 Interface requirements | 3 | 3 | 0 | 0 |
| §1.8.3 Database entities & relationships | 10 | 10 | 0 | 0 |
| §1.9 Project deliverables | 9 | 8 | 0 | 1 |
| **Total** | **63** | **61** | **1** | **1** |

The one partial item (multi-factor authentication) and the one unmet item (the
demonstration video, which is not a software artefact) are both explained in
full below.

---

## §1.4 · Scope of the project

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | Fully responsive, secure web platform on desktop and mobile browsers | ✅ | Mobile-first Tailwind layouts, verified 320 px → 1440 px+ |
| 2 | Residents view maintenance invoices | ✅ | `/resident/bills` |
| 3 | Residents log maintenance complaints | ✅ | `/resident/complaints/new` |
| 4 | Residents request visitor entry passes | ✅ | `/resident/visitors/new` |
| 5 | Residents book shared amenities (clubhouse, tennis courts) | ✅ | `/resident/amenities` — 6 seeded amenities |
| 6 | Residents participate in digital voting/notices | ✅ | `/resident/polls`, `/resident/notices` |
| 7 | Admins manage resident onboarding | ✅ | `/admin/residents` |
| 8 | Admins generate automated monthly maintenance bills | ✅ | `/admin/bills` → billing run |
| 9 | Admins oversee visitor logs | ✅ | `/admin/visitors`, `/admin/security` |
| 10 | Admins assign work tickets to maintenance staff | ✅ | `/admin/complaints/[id]` |
| 11 | Admins broadcast emergency notices | ✅ | `/admin/alerts` |
| 12 | Security log guests and vendors, verifying gate passes in real time | ✅ | `/guard/verify`, `/guard/walk-in` |
| — | Payment gateway and bank reconciliation **simulated** | ✅ | `simulatePayment`; every row carries `simulated = true` and the UI says so |

## §1.5 · Constraints

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Browser compatibility — Chrome, Edge, Safari, Firefox | ✅ | Standard web platform only; the camera-dependent QR scanner degrades to keypad entry |
| 2 | Responsiveness — security tablets, phones, desktops | ✅ | Guard console uses a comfortable density and large targets; tables become cards below `lg`; no horizontal page overflow at any breakpoint |
| 3 | Gate verification with minimal latency (< 2 s) | ✅ | Single indexed lookup, no external calls — measured ~15 ms; see [Testing §11.5](./testing.md#performance) |

## §1.6 · Functional requirements — Residents / Flat Owners

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1a | Secure login | ✅ | bcrypt cost 12, generic failure messages, lockout, rate limiting, revocable sessions |
| 1b | **Multi-factor support** | ⚠️ | **Partially implemented.** Single-factor with lockout, per-identifier and per-IP rate limiting, revocable server-side sessions and full audit logging. Authentication funnels through one service and one action, so a TOTP step slots in without touching anything else. See [Assumptions A-1](./assumptions.md#a-1-multi-factor-authentication). |
| 1c | Profile linking flat numbers | ✅ | `ResidentProfile.flatId` → `/resident/flat` |
| 1d | Vehicle registrations | ✅ | `/resident/vehicles`; registration unique society-wide |
| 1e | Emergency contacts | ✅ | `/resident/emergency` — personal plus society directory |
| 1f | Family/tenant details | ✅ | `FamilyMember` → `/resident/flat` |
| 2a | View current and historical maintenance bills | ✅ | `/resident/bills` |
| 2b | Download PDF receipts | ✅ | `GET /api/bills/[id]/receipt` — pdf-lib |
| 2c | Breakdown of charges (water, security, repairs) | ✅ | `BillCharge` — 9 charge types including all three named |
| 2d | Simulate digital fee payments | ✅ | Full or partial, six methods, receipt and transaction reference |
| 3a | Generate digital QR gate passes | ✅ | `createGatePass` + `qr-service` |
| 3b | For guests, delivery drivers and cab operators | ✅ | 6 visitor types including all three named |
| 3c | Custom time windows | ✅ | `validFrom`/`validUntil`, validated |
| 4a | Raise maintenance tickets | ✅ | `/resident/complaints/new` |
| 4b | Plumbing, electrical, elevator faults | ✅ | 9 categories including all three named |
| 4c | Photo uploads | ✅ | Up to 4, magic-byte verified, served through an authenticated route |
| 4d | Category tagging | ✅ | Required field, filterable |
| 4e | Status tracking (Pending, In-Progress, Resolved) | ✅ | Exactly those, plus `CLOSED` for formal closure |
| 5a | Check real-time amenity availability | ✅ | Live slot grid per amenity per day |
| 5b | Reserve clubhouse, pool, sports courts, party hall | ✅ | All four seeded, plus a tennis court and gym |
| 6a | Access official announcements | ✅ | `/resident/notices` |
| 6b | Event calendars | ✅ | `Notice.eventDate`/`eventLocation` with an upcoming-events panel |
| 6c | Society guidelines | ✅ | `/resident/guidelines` |
| 6d | Cast votes on community polls | ✅ | One vote per resident, enforced by a unique index |

## §1.6 · Functional requirements — Security Personnel

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1a | Record walk-in visitor details | ✅ | `/guard/walk-in` |
| 1b | Photograph | ✅ | `Visitor.photoUrl` stored and displayed. Live gate capture is not wired to the tablet camera — see [Assumptions A-2](./assumptions.md#a-2-visitor-photograph-capture) |
| 1c | Vehicle number | ✅ | On the visitor and denormalised onto the gate log for fast search |
| 1d | Target flat number | ✅ | Searchable picker with the primary resident and a call button |
| 1e | Entry timestamp | ✅ | Stamped server-side |
| 2a | Scan/verify resident-generated QR codes | ✅ | Camera decoding via `@zxing/browser` |
| 2b | Numeric gate keys | ✅ | Unique 6-digit code with an on-screen keypad |
| 2c | Instant access clearance | ✅ | ~15 ms decision; a separate confirm step prevents accidental consumption |
| 3a | Alerts for unapproved extended vendor stays | ✅ | `expectedExitAt` → overstay panel → notifies the host flat and admins |
| 3b | Delivery logging | ✅ | `DELIVERY`/`VENDOR` types with a company field |

## §1.6 · Functional requirements — Society Administration

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1a | Onboard/offboard residents, tenants and owners | ✅ | With a one-time temporary password; offboarding cascades correctly |
| 1b | Maintain flat occupancy status maps | ✅ | Visual floor-by-floor occupancy map per block |
| 2a | Generate monthly maintenance invoices | ✅ | One per occupied flat; re-runs skip already-billed flats |
| 2b | Apply penalties on overdue balances | ✅ | Configurable percentage and grace period; idempotent |
| 2c | Monitor collection reports | ✅ | Summary tiles, six-month trend, collection by block |
| 3a | Assign complaint tickets to maintenance personnel | ✅ | With a ranked recommendation |
| 3b | Monitor resolution SLAs | ✅ | Per-ticket badges, breach counter, average resolution time |
| 4 | Real-time entry/exit logs for all gates, visitors and staff | ✅ | `/admin/security` with filters and a seven-day chart |

## §1.6 · Common features & user journeys

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | Emergency Contact Directory | ✅ | `/resident/emergency`, `/guard/directory` — tap-to-dial |
| 2 | Society Guidelines | ✅ | `/resident/guidelines`, editable in Settings |
| 3 | Interactive Emergency Siren/Alert | ✅ | Full-width banner on every device + Web Audio siren offered as an explicit control (browsers block autoplay — see [A-12](./assumptions.md#a-12-emergency-siren)) |
| 4 | **Resident journey:** Login → Generate Visitor Pass → View Monthly Bill → Book Clubhouse → Log Plumbing Ticket → Track SLA | ✅ | Complete; covered end-to-end by `tests/e2e/resident-journey.spec.ts` |
| 5 | **Admin journey:** Login → Dashboard → Review Monthly Dues → Broadcast Emergency Notice → Assign Helpdesk Ticket → Audit Security Gate Logs | ✅ | Complete; covered end-to-end by `tests/e2e/gate-and-admin.spec.ts` |

## §1.7 · Non-functional requirements

| # | Requirement | Status | How |
|---|---|---|---|
| 1 | Data privacy & security | ✅ | Server-side authorisation everywhere; every query scoped by the caller's own id; complaint photos behind an authenticated route; password hashes never leave the server; probing another resident's record returns "not found" rather than a permission hint |
| 2 | High availability (24/7) | ✅ | Stateless requests with sessions in the database; connection pooling; the gate console degrades to keypad entry if the camera fails; housekeeping runs opportunistically rather than depending on a separate process |
| 3 | User-friendliness (non-technical guards, elderly residents) | ✅ | Guard console leads with two large actions at comfortable density; every rejection is a plain-language instruction; consistent status colours system-wide |
| 4 | Performance & speed (< 1.5 s) | ✅ | Server components, batched queries, request-scoped session caching, pagination, targeted indexes — measured in [Testing §11.5](./testing.md#performance) |
| 5 | Scalability (multi-tower, thousands of apartments) | ✅ | `Society → Block → Flat` hierarchy, indexes on every foreign key and filter column, pagination everywhere, aggregation in the database |
| 6 | Role-based security | ✅ | 28-permission matrix and route-prefix map, enforced at the edge and again server-side on every page and action |
| 7 | Audit logging (gate entries, complaint status changes, admin financial edits) | ✅ | Append-only `audit_logs`; all three named categories covered; no code path updates or deletes a row |
| 8 | Cross-platform compatibility | ✅ | Verified 320 px → 1440 px+; tables become cards below `lg`; wide content scrolls inside its own container |

## §1.8 · Interface requirements

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1.8.1 | Hardware — quad-core/16 GB server, tablet gate terminals with camera, standard clients, optional receipt printer | ✅ | Single Node process + PostgreSQL; guard console designed for a tablet; a hardware barcode scanner works because it types into the same field; the A5 gate pass PDF is print-ready |
| 1.8.2 | Software stack from the permitted options | ✅ | ReactJS + Tailwind (permitted frontend), Node.js (permitted backend), PostgreSQL 14+ (permitted database) |
| 1.8.3 | Database design & data dictionary | ✅ | [Database design](./database-design.md) and [ER diagram](./er-diagram.md) |

## §1.8.3 · Specified entities and relationships

| Entity / relationship | SRS attributes | Status | Notes |
|---|---|---|---|
| **Users** | `user_id` PK, `username`, `password_hash`, `role` | ✅ | Plus email, phone, status, lockout and audit timestamps |
| **Flats / Units** | `flat_id` PK, `block_name`, `flat_number`, `occupancy_type` | ✅ | `block_name` normalised into a `blocks` table; `occupancyType` is OWNER/TENANT as specified, with a separate `occupancyStatus` |
| **Visitors** | `visitor_id` PK, `flat_id` FK, `visitor_name`, `phone`, `vehicle_number`, `gate_pass_code` | ✅ | `gate_pass_code` normalised onto `gate_passes`, since one visitor may hold several passes each with its own window and status |
| **MaintenanceBills** | `bill_id` PK, `flat_id` FK, `amount_due`, `due_date`, `payment_status` | ✅ | `amount_due` split into `baseAmount`/`penaltyAmount`/`totalAmount`/`paidAmount` so partial payment is representable |
| **Complaints** | `complaint_id` PK, `resident_id` FK, `category`, `description`, `status`, `created_at` | ✅ | Plus priority, SLA target, assignee, resolution notes and a full status history |
| Flats → Residents (1:N) | | ✅ | Seed data includes flats with both an owner and a tenant |
| Flats → MaintenanceBills (1:N) | | ✅ | Unique per `(flat, year, month)` |
| Residents → Complaints (1:N) | | ✅ | |
| Flats → Visitors → GateLogs (1:N:N) | | ✅ | |
| Residents → AmenityBookings (1:N) | | ✅ | |

## §1.9 · Project deliverables

| # | Deliverable | Status | Where |
|---|---|---|---|
| 1 | Problem definition | ✅ | [docs/problem-definition.md](./problem-definition.md) |
| 2 | Design specifications | ✅ | [docs/architecture.md](./architecture.md), [docs/requirements.md](./requirements.md) |
| 3 | Diagrams — flowcharts for various activities, DFDs and so on | ✅ | [workflows.md](./workflows.md) (8 activity/flow diagrams), [dfd.md](./dfd.md) (levels 0, 1 and 2), [use-cases.md](./use-cases.md), [er-diagram.md](./er-diagram.md), [architecture.md](./architecture.md), [sitemap.md](./sitemap.md) — all Mermaid, so they stay editable |
| 4 | Database design | ✅ | [database-design.md](./database-design.md) with a full data dictionary |
| 5 | Test data used in the project | ✅ | [testing.md §11.3](./testing.md#113-test-data) — fixtures and the seeded demo dataset |
| 6 | Project installation instructions | ✅ | [installation.md](./installation.md) |
| 7 | User credentials for all types of users with passwords | ✅ | [installation.md §12.5](./installation.md#125-demo-credentials), the README, and the sign-in page |
| 8 | ReadMe listing assumptions, and `.sql` files with database and table definitions | ✅ | [README.md](../README.md) + [assumptions.md](./assumptions.md); `database/schema.sql` |
| 9 | **Video (.mp4) demonstrating the working application** | ❌ | **Not produced.** A screen recording is not a software artefact and cannot be generated from a codebase. Everything it would show is available to record: `npm run setup && npm run dev`, then sign in with each of the four documented accounts. The [user guide](./user-guide.md) is written as a walkthrough and can serve as the recording script; `tests/e2e/` drives exactly these journeys in a real browser. |
| — | Sitemap added to the home page | ✅ | Rendered as an interactive visual tree in the *Sitemap* section of `/`, with a full-page version at `/sitemap` |
| — | Hosting the application and sharing a URL (stated as preferable) | ❌ | Not deployed. The application is deployment-ready — see [installation.md §12.7](./installation.md#127-production-build) — but publishing to a public host is the submitter's decision, not something to do unprompted |

---

## The two outstanding items

### ⚠️ Multi-factor authentication (§1.6, Residents #1)

**What was built:** single-factor authentication with bcrypt cost-12 hashing,
account lockout after 8 failures, per-identifier and per-IP rate limiting,
revocable server-side sessions, and full audit logging of every attempt.

**What is missing:** a second factor (TOTP or SMS OTP).

**Why:** SMS OTP needs a paid gateway the SRS does not mention. TOTP is
self-contained and was the better fit, but it was deprioritised against
completing every other functional requirement. The authentication path is a
single choke point — `services/auth-service.ts` and `actions/auth-actions.ts` —
so the factor slots in between password verification and session creation
without touching any other module.

### ❌ Demonstration video (§1.9)

The SRS marks this MANDATORY. It is a screen recording of a human using the
application, which cannot be produced from source code. The application is
complete and runnable, and every journey the video would show is documented
step-by-step in the [user guide](./user-guide.md) and automated in
`tests/e2e/` — those specs are, in effect, the shot list.

Suggested recording order (about 8–10 minutes):

1. Landing page and the sitemap
2. Sign in as **Resident** → create a visitor pass (QR + gate code) → open the
   monthly bill and its breakdown → simulate payment → download the receipt →
   book an amenity → raise a plumbing ticket
3. Sign in as **Guard** (second browser) → scan or key in that gate code →
   allow entry → show the resident being notified → record the exit
4. Sign in as **Administrator** → dashboard and charts → occupancy map → assign
   the plumbing ticket → broadcast an emergency alert (show the banner and
   siren on the resident's screen) → resolve it → open the audit log
5. Sign in as **Maintenance Staff** → work the assigned ticket → resolve it
6. Back as **Resident** → see the resolution and rate the work
