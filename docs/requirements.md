# 2. Requirements

Every requirement from the SRS is listed here with its implementation location.
For the pass/partial/fail compliance summary see
[SRS-COMPLIANCE.md](./SRS-COMPLIANCE.md).

---

## 2.1 Functional requirements

### FR-R — For Residents / Flat Owners

#### FR-R1 · Account authentication & resident profile

*Secure login with multi-factor support. Profile management linking flat
numbers, vehicle registrations, emergency contacts and family/tenant details.*

| Sub-requirement | Implementation |
|---|---|
| Secure login | `services/auth-service.ts` · bcrypt (cost 12), generic failure messages to prevent account enumeration, temporary lockout after 8 failed attempts |
| Session management | `lib/auth/session.ts` · signed HTTP-only same-site cookie plus a revocable server-side `sessions` row |
| Multi-factor support | **Partially met.** The account model carries lockout and session-revocation fields and the login flow is a single choke point where a second factor slots in. A TOTP second factor is documented as a future improvement — see [Assumptions](./assumptions.md#a-1-multi-factor-authentication) |
| Flat linkage | `ResidentProfile.flatId` → `/resident/flat` |
| Vehicle registrations | `Vehicle` model → `/resident/vehicles` |
| Emergency contacts | `EmergencyContact` (personal scope) → `/resident/emergency` |
| Family / tenant details | `FamilyMember` model → `/resident/flat` |

#### FR-R2 · Maintenance dues & invoicing

*View current and historical maintenance bills, download PDF receipts, view
breakdown of charges (water, security, repairs) and simulate digital fee
payments.*

| Sub-requirement | Implementation |
|---|---|
| Current and historical bills | `/resident/bills` — every invoice for the flat, newest first |
| Charge breakdown | `BillCharge` rows rendered on `/resident/bills/[id]`; charge types include maintenance, water, security, repairs, common electricity, sinking fund, parking and penalty |
| PDF receipts | `services/pdf-service.ts` → `GET /api/bills/[id]/receipt` (pdf-lib; A4 receipt or invoice) |
| Payment simulation | `services/billing-service.ts#simulatePayment` — full or partial, six methods, receipt and transaction reference generated |

#### FR-R3 · Visitor pre-approval & gate passes

*Generate digital QR gate passes for pre-approved guests, delivery drivers and
cab operators with custom time windows.*

| Sub-requirement | Implementation |
|---|---|
| QR pass generation | `services/gate-service.ts#createGatePass` + `services/qr-service.ts` |
| Visitor types | `GUEST`, `DELIVERY`, `CAB`, `VENDOR`, `SERVICE`, `OTHER` |
| Custom time windows | `validFrom` / `validUntil`, validated to be future-facing and at most 30 days |
| Numeric fallback | A unique 6-digit `gateCode` for when a camera is unusable |
| Multi-entry passes | `maxEntries` / `entriesUsed` for recurring vendors |
| Printable pass | `GET /api/passes/[id]/pdf` — A5 pass with an embedded QR image |

#### FR-R4 · Complaint & helpdesk portal

*Raise maintenance tickets (plumbing, electrical, elevator faults) with photo
uploads, category tagging and status tracking (Pending, In-Progress, Resolved).*

| Sub-requirement | Implementation |
|---|---|
| Ticket creation | `/resident/complaints/new` → `services/complaint-service.ts#createComplaint` |
| Categories | Plumbing, Electrical, Elevator, Cleaning, Security, Water, Carpentry, Pest control, Other |
| Photo uploads | `services/upload-service.ts` — MIME plus magic-byte validation, 5 MB limit, up to 4 photos, served through the authenticated `/api/files` route |
| Status tracking | `PENDING → IN_PROGRESS → RESOLVED → CLOSED`, with a full `ComplaintUpdate` history |
| SLA tracking | `slaDueAt` derived from priority (4/12/48/96 h); state shown as On track · Due soon · SLA breached · Met SLA · Missed SLA |

#### FR-R5 · Facility & amenity booking

*Check real-time availability and reserve community amenities (clubhouse,
swimming pool, sports courts, party hall).*

| Sub-requirement | Implementation |
|---|---|
| Real-time availability | `services/amenity-service.ts#getDaySlots` renders a live slot grid per amenity per day |
| Reservation | `#createBooking` with slot-grid alignment, capacity, advance-window and closing-time checks |
| Conflict prevention | A composite unique index on `(amenityId, startsAt, status)` **plus** an overlap check inside a serializable transaction |
| Cancellation | Bound by the amenity's `minCancelHours` for residents; unrestricted for the office |
| Approval flow | `requiresApproval` amenities create a `PENDING` booking the committee reviews |

#### FR-R6 · Notice board & digital polling

*Access official announcements, event calendars, society guidelines and cast
votes on community polls.*

| Sub-requirement | Implementation |
|---|---|
| Announcements | `/resident/notices` with category, priority, pinning, publish/expiry windows and audience targeting |
| Event calendar | `Notice.eventDate` / `eventLocation`, surfaced as an "Upcoming events" panel |
| Society guidelines | `/resident/guidelines` renders `Society.guidelines` through a safe Markdown renderer |
| Voting | `services/community-service.ts#castVote` — one vote per resident per poll, enforced by a unique database constraint |

---

### FR-S — For Security Personnel (Gate Management)

#### FR-S1 · Visitor log entry

*Record walk-in visitor details, photograph, vehicle number, target flat number
and entry timestamp.*

| Sub-requirement | Implementation |
|---|---|
| Walk-in logging | `/guard/walk-in` → `#logWalkInVisitor` |
| Visitor details | Name, phone, type, company, ID proof type and number |
| Photograph | `Visitor.photoUrl` exists in the schema and is displayed where present. Live capture at the gate is a documented limitation — see [Assumptions](./assumptions.md#a-2-visitor-photograph-capture) |
| Vehicle number | Captured on the visitor and denormalised onto the gate log |
| Target flat | Searchable flat picker showing the primary resident and a call button |
| Entry timestamp | Stamped server-side on `GateLog.entryAt` |

#### FR-S2 · Pass verification

*Scan/verify resident-generated visitor QR codes or numeric gate keys for
instant access clearance.*

| Sub-requirement | Implementation |
|---|---|
| QR scanning | `app/guard/verify/qr-scanner.tsx` — camera decoding via `@zxing/browser`, lazily loaded |
| Numeric gate key | On-screen keypad with large targets |
| Verification | `#verifyGateCode` resolves a QR payload, a pass code or a 6-digit code and returns a plain-language decision |
| Rejection reasons | Not found · Not yet valid · Expired · Cancelled · Rejected · All entries used · Already inside |
| Clearance | A separate confirm step records the entry, so an accidental scan cannot consume a pass |

#### FR-S3 · Overstay & delivery alerts

*Receive system alerts for unapproved extended vendor stays inside the society
premises.*

| Sub-requirement | Implementation |
|---|---|
| Expected exit | `GateLog.expectedExitAt`, defaulted from the pass window or four hours for a walk-in |
| Overstay detection | `#findOverstayingVisitors`, surfaced at the top of the guard dashboard |
| Alerting | `flagOverstayAction` notifies the host flat and every administrator, and marks the log `OVERSTAY` |
| Delivery logging | `DELIVERY` and `VENDOR` visitor types with a company field |

---

### FR-A — For Society Administration

#### FR-A1 · Resident & flat management

*Onboard/offboard residents, tenants and owners; maintain flat occupancy status
maps.*

| Sub-requirement | Implementation |
|---|---|
| Onboarding | `#onboardResident` creates the login and links the flat, returning a one-time temporary password |
| Offboarding | `#offboardResident` soft-deletes the profile, deactivates the login, revokes sessions, cancels active passes, re-evaluates flat occupancy and promotes a new primary resident |
| Owner / tenant | `ResidentProfile.residentType`, reflected on `Flat.occupancyType` |
| Occupancy map | `/admin/flats` → Occupancy map tab: a floor-by-floor visual grid per block |

#### FR-A2 · Billing engine

*Generate monthly maintenance invoices, apply penalties on overdue balances and
monitor collection reports.*

| Sub-requirement | Implementation |
|---|---|
| Invoice generation | `#generateMonthlyBills` — one invoice per occupied flat, per-flat base charge plus configurable common charges; re-runs skip already-billed flats |
| Penalties | `#applyOverduePenalties` applies the society's configured percentage after its grace period, adds a `PENALTY` charge line, and is idempotent |
| Collection reports | `/admin/bills` summary tiles, `/admin/reports` collection-by-block and a six-month billed-vs-collected chart |

#### FR-A3 · Helpdesk routing

*Assign resident complaint tickets to dedicated maintenance personnel and
monitor resolution SLAs.*

| Sub-requirement | Implementation |
|---|---|
| Assignment | `#assignComplaint` with a recommendation ranked by department match then current workload |
| SLA monitoring | SLA badges on every ticket, an SLA-breached tile on the dashboard, and average resolution time in reports |
| Technician performance | `/admin/reports` — assigned, resolved and average resident rating per technician |

#### FR-A4 · Security supervision

*Access real-time entry/exit logs for all gates, visitors and staff members.*

| Sub-requirement | Implementation |
|---|---|
| Gate logs | `/admin/security` — filterable by status, gate and verification method |
| Visitor register | `/admin/visitors` — every pass issued, with status and usage |
| Traffic analytics | Seven-day entry/exit chart, inside-now and overstay counters |

---

### FR-C — Common features & user journeys

| Requirement | Implementation |
|---|---|
| **Emergency contact directory** | Society-wide directory at `/resident/emergency` and `/guard/directory`; every number is a one-tap `tel:` link |
| **Society guidelines** | `/resident/guidelines`, editable by the administrator at `/admin/settings` |
| **Interactive emergency siren/alert** | `components/layout/emergency-banner.tsx` — a full-width banner on every signed-in device plus a Web Audio two-tone siren, offered as an explicit control because browsers block autoplaying audio |

#### Resident journey

> Login → Generate Visitor Pass → View Monthly Bill → Book Clubhouse → Log
> Plumbing Ticket → Track SLA

Implemented end-to-end and covered by
`tests/e2e/resident-journey.spec.ts`. See
[Workflows](./workflows.md#resident-journey).

#### Administrator journey

> Login → Dashboard → Review Monthly Dues → Broadcast Emergency Notice → Assign
> Helpdesk Ticket → Audit Security Gate Logs

Implemented end-to-end and covered by `tests/e2e/gate-and-admin.spec.ts`. See
[Workflows](./workflows.md#administrator-journey).

---

## 2.2 Non-functional requirements

| Requirement | SRS description | How it is met |
|---|---|---|
| **Data privacy & security** | Strict access controls protecting resident personal information, phone numbers and vehicle records | Server-side authorisation on every page and action; queries scoped by the caller's own `residentId`; complaint photos served only through an authenticated route with an ownership check; password hashes never leave the server; a resident probing another resident's record gets "not found", never a permission hint that would confirm the record exists |
| **High availability** | 24/7 continuous operation for uninterrupted gate clearance and emergency alerts | Stateless request handling with sessions in the database, so any instance can serve any request; connection pooling through a single Prisma client; the gate console degrades to keypad entry when the camera fails; scheduled housekeeping runs opportunistically rather than needing a separate job runner that could fail independently |
| **User-friendliness** | Simplified interface for non-technical security staff and elderly residents | The guard console leads with two large actions and uses a comfortable density with bigger touch targets; every verification rejection is written as a plain-language instruction ("Ask the resident to issue a new one") rather than an error code; consistent status colours across every screen |
| **Performance & speed** | Page response under 1.5 s; fast checkpoint validation and pass scanning | Server components with a single batched query set per dashboard; `React.cache` de-duplicates the session lookup within a request; pagination on every list; targeted indexes on each filter column; gate verification is one indexed lookup — see [Testing](./testing.md#performance) |
| **Scalability** | Database architecture scalable to multi-tower complexes with thousands of apartments and daily visitors | Normalised schema with a `Society → Block → Flat` hierarchy; indexes on every foreign key and filter column; no unbounded queries — every list is paginated; aggregates computed with `groupBy` in the database rather than in application memory |
| **Role-based security** | Granular privilege management distinguishing Resident, Guard, Staff and Administrator | `lib/rbac.ts` defines a 28-permission matrix and a route-prefix map; enforced at the edge by `middleware.ts` and again server-side by `requireRole()` / `requireResident()` / `requireStaff()` in every page and action |
| **Audit logging** | Immutable records for all security gate entries, complaint status changes and admin financial edits | `lib/audit.ts` writes append-only `AuditLog` rows; nothing in the application updates or deletes them; the admin console offers read-only search and filtering |
| **Cross-platform compatibility** | Flawless execution across mobile devices, desktop browsers and gate-terminal tablets | Mobile-first Tailwind layouts verified from 320 px to 1440 px+; tables switch to cards below `lg`; wide content scrolls inside its own container so the page body never scrolls horizontally |

## 2.3 Interface requirements

### 2.3.1 Hardware (SRS §1.8.1)

| Component | Requirement | Notes |
|---|---|---|
| Server | Quad-core processor, 16 GB RAM, SSD | A single Node.js process plus PostgreSQL fits comfortably |
| Gate terminals | Android/iOS tablet or desktop workstation with camera or barcode scanner | The guard console is designed for a tablet; the camera drives the QR scanner and a hardware barcode scanner works too, since it types into the same input |
| Client devices | Standard smartphones or desktop computers | Responsive from 320 px |
| Peripherals | Gate receipt printer (optional) | The A5 gate-pass PDF is print-ready |

### 2.3.2 Software (SRS §1.8.2)

The SRS offers a choice of stacks. SmartSociety uses:

| Component | Choice | Why |
|---|---|---|
| Frontend | React 19 + Next.js 15 App Router, Tailwind CSS 4 | Listed as a supported option (ReactJS, Tailwind CSS). Server components keep dashboard payloads small, which matters on a gate tablet. |
| Backend | Node.js (Next.js server actions and route handlers), TypeScript | Listed as a supported option (Node.js). One language across the stack, with types shared between server and client. |
| Database | PostgreSQL 17 | Listed as a supported option (PostgreSQL 14+). Chosen for transactional guarantees, partial/composite unique indexes and `Decimal` money handling. |
| ORM | Prisma 6 | Type-safe queries and a migration history that doubles as the SQL deliverable. |

See [Architecture](./architecture.md) for the full rationale.
