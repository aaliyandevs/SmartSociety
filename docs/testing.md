# 11. Testing

## 11.1 Strategy

Three layers, each testing what it is best placed to test.

| Layer | Tool | Count | Runs against | Tests |
|---|---|---|---|---|
| **Unit** | Vitest | 45 | Pure functions | Formatting, validation schemas, RBAC matrix, QR parsing, SLA computation |
| **Integration** | Vitest + PostgreSQL | 105 | A **real** database (`smartsociety_test`) | Domain services, transactions, and the constraints that enforce the business rules |
| **End-to-end** | Playwright + Chromium | 30 (26 journeys + 4 session setup) | The running application with seeded demo data | Complete user journeys through a real browser |
| | | **180 total** | | |

The integration tests deliberately use a real PostgreSQL database rather than a
mock. Several of the requirements — "a resident must not be able to vote twice",
"prevent conflicting bookings" — are enforced by database constraints, and a
mock would happily let a broken implementation pass.

### Session reuse in the end-to-end suite

`tests/e2e/auth.setup.ts` signs in once per role and saves the session; the
feature specs restore it rather than signing in again on every test.

This was not only a speed optimisation. The first version signed in inside
`beforeEach`, and against a production build the suite started failing — because
the application rate-limits sign-in attempts to 8 per identifier per 5 minutes,
and the suite was tripping its own security control. Rather than raise the limit
to accommodate the tests, the tests were changed to behave like a real user:
sign in once, then work. `auth.spec.ts` still signs in for real, because
verifying the sign-in flow is its entire purpose.

> **If you run the full suite three or more times within five minutes**, the
> remaining sign-ins (4 in setup plus 7 in `auth.spec.ts`) can still reach the
> per-identifier limit and the setup project will fail. That is the rate limiter
> working, not a defect. Either wait for the window to pass or restart the
> server, which clears the in-process counters.

## 11.2 Running the tests

```bash
# One-time: start PostgreSQL and seed the demo data
npm run db:up
npm run db:seed

# Unit + integration (creates and migrates smartsociety_test automatically)
npm test

# Watch mode while developing
npm run test:watch

# End-to-end (starts the dev server if one is not already running)
npx playwright install chromium   # first time only
npm run test:e2e

# Everything the CI gate runs
npm run verify        # typecheck + lint + unit/integration
```

### Latest run

```
 ✓ tests/unit/utils.test.ts                    (8 tests)
 ✓ tests/unit/rbac.test.ts                     (7 tests)
 ✓ tests/unit/validations.test.ts             (20 tests)
 ✓ tests/unit/qr-and-sla.test.ts              (10 tests)
 ✓ tests/integration/auth.test.ts             (21 tests)
 ✓ tests/integration/gate.test.ts             (26 tests)
 ✓ tests/integration/billing.test.ts          (16 tests)
 ✓ tests/integration/complaints.test.ts       (17 tests)
 ✓ tests/integration/amenities-and-polls.test.ts (25 tests)

 Test Files  9 passed (9)
      Tests  150 passed (150)

 Playwright (against a production build): 30 passed
```

## 11.3 Test data

### Integration fixtures — `tests/setup/fixtures.ts`

Each integration file starts from a deterministic minimal society. It is the
smallest structure that still exercises every relationship the SRS specifies.

| Entity | Fixture |
|---|---|
| Society | Test Society · 2% penalty · 5-day grace |
| Block | A · 4 floors |
| Flats | A-101 (owner-occupied, ₹3,000 base, 2 parking) · A-102 (tenant, ₹4,000 base, 1 parking) |
| Administrator | `admin@test.local` |
| Residents | `resident@test.local` (owner of A-101) · `resident2@test.local` (tenant of A-102) |
| Guard | `guard@test.local` · Main Gate |
| Technician | `tech@test.local` · Plumbing |
| Amenity | Test Clubhouse · 08:00–20:00 · 60-min slots · ₹500 · capacity 50 · cancel window 4 h |
| Password | `Test@12345` (bcrypt cost 4 — fast, since hashing strength is tested separately) |

`resetDatabase()` truncates every table between files, so no test can depend on
another's leftovers.

### Demo data — `prisma/seed.ts`

The end-to-end tests and manual evaluation both run against the seeded society.
The seed uses a fixed pseudo-random seed, so every run produces identical data.

| Entity | Volume |
|---|---|
| Society / blocks / flats | 1 · 4 towers · 48 flats |
| Residents | 42 across 38 occupied flats (10 vacant), including 4 flats with both an owner and a tenant |
| Staff | 3 security guards · 6 maintenance technicians |
| Amenities | 6 — Clubhouse, Swimming Pool, Tennis Court, Sports Court, Party Hall, Gymnasium |
| Amenity bookings | 48 — completed, upcoming, pending approval and cancelled |
| Maintenance bills | 190 across five billing periods |
| Payments | 153 successful payments with receipts |
| Complaints | 28 — 6 pending, 6 in progress, 9 resolved, 7 closed |
| Visitors / passes / gate logs | 78 · 52 · 70 (including 5 currently inside, 1 overstaying, 1 refused) |
| Notices | 10 with events, pinning and expiry |
| Polls | 4 — 2 active, 1 closed, 1 draft — with 82 votes |
| Emergency alerts | 3, all resolved (so the demo does not open with a siren) |
| Notifications | 10 across all four roles |
| Audit log | 15 seeded entries, plus everything the application writes |

## 11.4 Test cases

### TC-A · Authentication (`tests/integration/auth.test.ts`)

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-A01 | Hash and verify a password | Hash is not the plaintext, starts `$2`, verifies correctly | ✅ |
| TC-A02 | Hash the same password twice | Different hashes (unique salts) | ✅ |
| TC-A03 | Sign and verify a session token | Claims round-trip intact | ✅ |
| TC-A04 | Verify with the wrong secret | Rejected | ✅ |
| TC-A05 | Tamper with the role claim | Rejected — the signature no longer matches | ✅ |
| TC-A06 | Expired token | Rejected | ✅ |
| TC-A07 | Token digest storage | 64-hex digest, deterministic, not the token | ✅ |
| TC-A08 | Sign in by email | Succeeds with the correct role | ✅ |
| TC-A09 | Sign in by username, mixed case | Succeeds | ✅ |
| TC-A10 | Wrong password | `UnauthorizedError` | ✅ |
| TC-A11 | Unknown account vs wrong password | **Identical** message — no enumeration | ✅ |
| TC-A12 | Failed attempt is audited | `auth.login.failed` row written | ✅ |
| TC-A13 | 8 failed attempts | Account locked; even the correct password is refused | ✅ |
| TC-A14 | Suspended account | Refused with "not active" | ✅ |
| TC-A15 | Successful sign-in after a failure | Counter reset, `lastLoginAt` stamped | ✅ |
| TC-A16 | Change password with a wrong current one | Refused | ✅ |
| TC-A17 | Change password successfully | Other sessions revoked; old password stops working | ✅ |
| TC-A18 | Derive a username | Derived from the email local part | ✅ |
| TC-A19 | Username collision | Suffixed rather than duplicated | ✅ |
| TC-A20 | Rate limit window | Allows up to the limit, then blocks with a retry-after | ✅ |
| TC-A21 | Rate limit keys | Tracked independently | ✅ |

### TC-G · Gate & visitor management (`tests/integration/gate.test.ts`)

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-G01 | Create a pass | Pass code, 6-digit gate code and QR token generated | ✅ |
| TC-G02 | Visitor linkage | Visitor created and linked to the flat | ✅ |
| TC-G03 | Five passes at once | All gate codes and QR tokens distinct | ✅ |
| TC-G04 | Verify by QR payload | Granted, with visitor, flat and host | ✅ |
| TC-G05 | Verify by 6-digit code | Granted | ✅ |
| TC-G06 | Verify by pass code, lower case | Granted | ✅ |
| TC-G07 | Unknown code | Denied · `NOT_FOUND` with guidance | ✅ |
| TC-G08 | Window not yet open | Denied · `TOO_EARLY` | ✅ |
| TC-G09 | Window elapsed | Denied · `EXPIRED`; pass marked `EXPIRED` | ✅ |
| TC-G10 | Cancelled pass | Denied · `CANCELLED` | ✅ |
| TC-G11 | Single-entry pass reused | Denied · `ALREADY_USED` | ✅ |
| TC-G12 | Duplicate scan while inside | Denied · `ALREADY_INSIDE` | ✅ |
| TC-G13 | Code shorter than 4 chars | Denied · `INVALID` | ✅ |
| TC-G14 | Approve entry | `INSIDE` log, entry consumed, timestamp stamped | ✅ |
| TC-G15 | Multi-entry pass | Stays `ACTIVE` until the last entry | ✅ |
| TC-G16 | Concurrent second entry | `ConflictError` | ✅ |
| TC-G17 | Record exit | `EXITED` with a timestamp | ✅ |
| TC-G18 | Duplicate exit | `ConflictError` | ✅ |
| TC-G19 | Refuse entry | `DENIED` log with reason; pass `REJECTED` | ✅ |
| TC-G20 | Exit against a refused entry | `ConflictError` | ✅ |
| TC-G21 | Walk-in visitor | Visitor + `INSIDE` log, method `MANUAL`, no pass | ✅ |
| TC-G22 | Walk-in for a non-existent flat | Rejected | ✅ |
| TC-G23 | Overstay detection | Visitor past expected exit is returned | ✅ |
| TC-G24 | Expire stale passes | Elapsed active passes become `EXPIRED` | ✅ |
| TC-G25 | Cancel own unused pass | Cancelled with the reason recorded | ✅ |
| TC-G26 | Cancel another resident's pass | "No longer exists" — existence not revealed | ✅ |

### TC-B · Billing & payments (`tests/integration/billing.test.ts`)

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-B01 | Generate a billing run | One invoice per occupied flat; per-flat charge added | ✅ |
| TC-B02 | Re-run the same period | 0 created, 2 skipped — safe to repeat | ✅ |
| TC-B03 | Restrict to one block | Only that block billed | ✅ |
| TC-B04 | Invoice numbering | Unique and readable (`INV-202606-A101`) | ✅ |
| TC-B05 | Pay in full | `PAID`, receipt and transaction reference issued | ✅ |
| TC-B06 | Partial payment | `PARTIALLY_PAID` with the correct balance | ✅ |
| TC-B07 | Overpay attempt | Capped at the outstanding balance | ✅ |
| TC-B08 | Pay a settled invoice | `ConflictError` | ✅ |
| TC-B09 | Pay a cancelled invoice | `ConflictError` | ✅ |
| TC-B10 | Payment is flagged simulated | `simulated = true`, gateway note recorded | ✅ |
| TC-B11 | Overdue detection | Unpaid past due becomes `OVERDUE` | ✅ |
| TC-B12 | Apply a penalty | 2% added as a `PENALTY` line; re-running adds nothing | ✅ |
| TC-B13 | Inside the grace period | No penalty applied | ✅ |
| TC-B14 | Collection summary | Billed, collected, outstanding and rate all correct | ✅ |
| TC-B15 | Receipt PDF | Valid `%PDF-` document over 1 KB | ✅ |
| TC-B16 | Invoice PDF with no payment | Valid PDF | ✅ |

### TC-C · Complaints (`tests/integration/complaints.test.ts`)

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-C01 | Raise a ticket | `PENDING`, ticket number, SLA target from priority | ✅ |
| TC-C02 | Critical priority | 4-hour SLA | ✅ |
| TC-C03 | Opening history entry | One update recorded, authored by the resident | ✅ |
| TC-C04 | Assign a technician | `IN_PROGRESS`, assignment and first-response stamped | ✅ |
| TC-C05 | Raise priority on assignment | SLA re-based from creation | ✅ |
| TC-C06 | Assign a closed ticket | `ConflictError` | ✅ |
| TC-C07 | Assignment recommendation | Department match ranked first | ✅ |
| TC-C08 | Resolve a ticket | `RESOLVED` with `resolvedAt` and resolution notes | ✅ |
| TC-C09 | Technician touches another's ticket | `NotFoundError` | ✅ |
| TC-C10 | Invalid transition from CLOSED | `ConflictError` | ✅ |
| TC-C11 | Reopen a resolved ticket | `resolvedAt` cleared | ✅ |
| TC-C12 | Close a ticket | `closedAt` stamped | ✅ |
| TC-C13 | Full transition trail | Four ordered history entries | ✅ |
| TC-C14 | Public note | Recorded, resident notified | ✅ |
| TC-C15 | Internal note | Flagged internal, filtered from the resident view | ✅ |
| TC-C16 | Statistics | Counts by status, SLA breaches, category ranking | ✅ |
| TC-C17 | Per-resident statistics | Scoped correctly | ✅ |

### TC-M · Amenities & polls (`tests/integration/amenities-and-polls.test.ts`)

| ID | Case | Expected | Result |
|---|---|---|---|
| TC-M01 | Create a booking | `CONFIRMED` with a code, fee and correct end time | ✅ |
| TC-M02 | Multi-slot booking | Fee and duration multiply correctly | ✅ |
| TC-M03 | **Double booking** | Second resident refused with `ConflictError` | ✅ |
| TC-M04 | Straddling overlap | Multi-slot range overlapping an existing booking refused | ✅ |
| TC-M05 | Own overlapping booking | Refused | ✅ |
| TC-M06 | Booking in the past | Refused | ✅ |
| TC-M07 | Off-grid start time | Refused | ✅ |
| TC-M08 | Runs past closing time | Refused | ✅ |
| TC-M09 | Over capacity | Refused | ✅ |
| TC-M10 | Beyond the advance window | Refused | ✅ |
| TC-M11 | Closed amenity | Refused | ✅ |
| TC-M12 | Slot grid | Taken slot marked unavailable, attributed to the flat; 12 slots for 12 opening hours | ✅ |
| TC-M13 | Cancel then rebook | Slot released for another resident | ✅ |
| TC-M14 | Cancellation window | Resident refused inside it; administrator allowed | ✅ |
| TC-M15 | Cancel another's booking | `NotFoundError` | ✅ |
| TC-M16 | Approval workflow | `PENDING` → approved; second review refused | ✅ |
| TC-M17 | Elapsed bookings | Marked `COMPLETED` | ✅ |
| TC-M18 | Cast a vote | Recorded | ✅ |
| TC-M19 | **Vote twice** | Refused — "You have already voted" | ✅ |
| TC-M20 | **Bypass the service layer** | Direct insert rejected by the unique index | ✅ |
| TC-M21 | Two residents vote | Both recorded | ✅ |
| TC-M22 | Vote on a draft or closed poll | Refused | ✅ |
| TC-M23 | Option from another poll | `NotFoundError` | ✅ |
| TC-M24 | Tally | Counts and percentages correct | ✅ |
| TC-M25 | Close elapsed polls | Status updated | ✅ |

### TC-U · Unit tests

| File | Covers |
|---|---|
| `utils.test.ts` | Currency, Indian number grouping, enum humanising, initials, minute→label, **local-time date input (no UTC day-shift)**, truncation |
| `rbac.test.ts` | Protected prefixes, lookalike prefixes (`/administration` ≠ `/admin`), per-role route access, admin cross-role observation, permission matrix, role landing pages |
| `validations.test.ts` | Phone, vehicle plate normalisation, password strength, login identifier, gate-pass windows, complaint length, poll option uniqueness, amenity slot divisibility |
| `qr-and-sla.test.ts` | QR payload round-trip, bare/URL/prefixed code parsing, SLA due dates, SLA state transitions |

### TC-E · End-to-end (Playwright, 26 journey tests plus 4 session-setup tests)

| ID | Journey step | Assertion |
|---|---|---|
| TC-E01 | Landing page | Renders with the required sitemap listing all four role areas |
| TC-E02 | Unauthenticated access | Redirected to `/login?next=…` |
| TC-E03 | Wrong password | Generic refusal, stays on `/login` |
| TC-E04–07 | Each role signs in | Lands on its own dashboard |
| TC-E08 | Resident opens `/admin/bills` | Redirected to `/unauthorized` |
| TC-E09 | Guard opens `/admin` | Redirected to `/unauthorized` |
| TC-E10 | Sign out | Session cleared; protected route redirects |
| TC-E11 | **Generate a visitor pass** | QR image and 6-digit gate code rendered |
| TC-E12 | **View the monthly bill** | Charge breakdown and total payable shown |
| TC-E13 | **Book an amenity** | Booking confirmed and listed under upcoming |
| TC-E14 | **Log a plumbing ticket and track the SLA** | SLA panel shows On track / Due soon / Breached |
| TC-E15 | Notices and guidelines | Notice detail and rulebook render |
| TC-E16 | **Vote once per poll** | After voting, no ballot is offered again |
| TC-E17 | **Full gate loop** | Resident creates a pass → guard verifies → allows entry → the same code is then refused as "already inside" → exit recorded |
| TC-E18 | Unknown gate code | "Do not admit" with a plain-language reason |
| TC-E19 | Walk-in entry | Visitor logged against the searched flat |
| TC-E20 | Admin dashboard | Live statistics and charts |
| TC-E21 | Occupancy map | Every block rendered with occupied counts |
| TC-E22 | Assign a complaint | Ticket routed to a technician |
| TC-E23 | Gate logs | Seven-day traffic chart and inside-now counter |
| TC-E24 | Audit log | Append-only notice, entries filterable by category |
| TC-E25 | **Emergency alert** | Broadcast → banner appears on the device → resolved → banner clears |
| TC-E26 | Technician updates a ticket | Status changed and the work note recorded |

## 11.5 Performance

Measured on the reference machine (the SRS asks for < 1.5 s pages and < 2 s gate
verification).

Measured with `npm run check:pages` against a **production build**
(`npm run build && npm start`) on the seeded 48-flat society.

| Route | Measured | Requirement |
|---|---|---|
| `/admin` — the heaviest page, 14 batched queries and 3 charts | 115 ms warm (494 ms first hit) | < 1.5 s ✅ |
| `/admin/reports` | 107 ms | < 1.5 s ✅ |
| `/admin/flats` — 48 units plus the occupancy map | 115 ms | < 1.5 s ✅ |
| `/resident` | 40 ms | < 1.5 s ✅ |
| `/guard` | 39 ms | < 1.5 s ✅ |
| `/guard/verify` | 18 ms | < 1.5 s ✅ |
| `/staff` | 45 ms | < 1.5 s ✅ |
| **Slowest of all 55 routes** | 115 ms warm | < 1.5 s ✅ |

| Operation | Measured | Requirement |
|---|---|---|
| Gate pass verification (single indexed lookup) | ~15 ms | < 2 s ✅ |
| Full gate clearance (verify + record entry + notify host) | ~120 ms | < 2 s ✅ |
| Bill generation across 38 occupied flats | ~600 ms | — |
| Receipt PDF generation | ~25 ms | — |

Timings under `npm run dev` include on-demand compilation and are an order of
magnitude higher; always measure against a production build.

`npm run check:pages` requests all 55 authenticated routes and prints the status
and elapsed time for each, which is the quickest way to re-measure after a
change. Note that timings in `npm run dev` include on-demand compilation and are
not representative; measure against `npm run build && npm start`.

## 11.6 What is not covered

Stated plainly rather than implied:

- **Visual regression testing.** Layouts were verified manually at 320, 375,
  425, 768, 1024, 1280 and 1440 px, but nothing guards against a future visual
  regression automatically.
- **Load and soak testing.** The scalability claims rest on the schema design,
  the indexes and the pagination, not on a measured load test.
- **Cross-browser E2E.** The suite runs on Chromium. The application uses no
  browser-specific APIs, and the one capability that varies — camera access for
  QR scanning — degrades to keypad entry, but Firefox and Safari were checked by
  hand rather than by the suite.
- **Accessibility auditing.** Semantic HTML, labelled controls, focus-visible
  styling, `prefers-reduced-motion` and keyboard operability are implemented
  throughout, but there is no automated axe run in CI.
