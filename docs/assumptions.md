# 14. Assumptions & Known Limitations

The SRS is silent on a number of operational details. Each decision taken in its
place is recorded here, with the reasoning, so an evaluator can judge the
judgement rather than guess at it.

---

## Assumptions

### A-1 · Multi-factor authentication

**SRS text:** "Secure login with multi-factor support." (§1.6, Residents #1)

**Assumption:** the requirement is read as *the system must be architected so a
second factor can be added*, rather than *a second factor must ship*. What is
implemented is single-factor authentication hardened at the points that matter
in practice:

- bcrypt hashing at cost 12
- generic failure messages, so a wrong password and an unknown account are
  indistinguishable
- temporary account lockout after 8 consecutive failures
- per-identifier and per-IP rate limiting
- revocable server-side sessions, so a compromised session can be killed
- every attempt written to the audit log

Authentication funnels through a single service (`services/auth-service.ts`) and
a single action, so a TOTP step slots in between password verification and
session creation without touching anything else. This is the one requirement not
fully met, and it is called out as such in
[SRS-COMPLIANCE.md](./SRS-COMPLIANCE.md).

### A-2 · Visitor photograph capture

**SRS text:** "Record walk-in visitor details, photograph, vehicle number…"
(§1.6, Security #1)

**Assumption:** the data model must carry the photograph; live capture at the
gate depends on hardware outside the scope of a browser application. The
`Visitor.photoUrl` column exists and any stored photograph is displayed
wherever the visitor appears. The walk-in form does not currently open the
camera to take one, because a reliable gate photograph needs a fixed camera and
consistent lighting rather than a tablet's front-facing lens. The upload
pipeline used for complaint photos (`services/upload-service.ts`) is
general-purpose and would serve this directly.

### A-3 · Payment gateway

**SRS text:** "Payment gateway processing and automated banking reconciliation
are simulated for scope compliance." (§1.4)

**Assumption:** simulation should be faithful, not fake. A simulated payment
produces a real `Payment` row, a unique receipt number, a transaction reference
and a downloadable PDF receipt — everything a live gateway would yield except
the money movement. Each row carries `simulated = true`, and the interface says
so plainly rather than pretending a charge occurred. Swapping in a real gateway
means replacing the body of one function, `simulatePayment`.

### A-4 · File storage

**Assumption:** uploaded complaint photos are written to a local directory
(`uploads/`) and served through an authenticated route handler rather than from
`public/`. This keeps the deployment to a single process and, more importantly,
means a photo of the inside of someone's flat is not fetchable by anyone who
guesses a URL.

On a platform with an ephemeral filesystem this needs object storage instead.
`services/upload-service.ts` is the only place that touches the filesystem, so
that is a single-file change.

### A-5 · Notification delivery

**Assumption:** "notifications" means in-app notifications. SMS and email
delivery would require a third-party provider, credentials and per-message cost,
none of which the SRS mentions. The notification model carries everything an
external channel would need (recipient, type, title, body, deep link, urgency),
so adding a delivery adapter is additive.

### A-6 · Real-time updates

**Assumption:** a short polling interval satisfies "real-time" for this system.
The notification bell polls every 45 seconds and the emergency banner every 30,
and both pause while the tab is hidden. Gate verification — the one genuinely
latency-sensitive path — is synchronous and returns in milliseconds, so it does
not depend on polling at all. WebSockets would add a stateful connection to a
deployment the SRS describes as a single server.

### A-7 · Scheduled tasks

**Assumption:** the housekeeping a cron job would normally do (expiring stale
passes, marking bills overdue, completing elapsed bookings, closing finished
polls) runs opportunistically when the relevant dashboard loads. Each operation
is idempotent and indexed, so it is cheap and safe to repeat. This avoids a
second process that can fail silently and leave the data stale. A production
deployment at scale would move these to a scheduled job; the functions are
already isolated and callable.

### A-8 · Single society per deployment

**Assumption:** one deployment serves one society. The schema is nonetheless
rooted at a `Society` row with `Block` and `Flat` beneath it, so multi-society
tenancy is a matter of scoping queries rather than reshaping tables. This
directly serves the SRS's scalability requirement for multi-tower complexes.

### A-9 · Currency and locale

**Assumption:** Pakistani Rupees, `en-PK` formatting (standard thousands
grouping), 11-digit Pakistani mobile numbers (`03XXXXXXXXX`) and Pakistani
vehicle registration patterns (e.g. `LEA1234`). All formatting is centralised
in `lib/utils.ts` and all validation in `lib/validations/`.

The SRS's own scenario is written around an Indian housing society; the
locale, seed data, currency and validation formats were switched to a
Pakistani society afterward at the user's request. If you need to revert to
the original Indian locale, the equivalents are: `en-IN` formatting, INR
currency, 10-digit mobile numbers matching `/^[6-9]\d{9}$/`, and vehicle plates
matching `/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/`.

### A-10 · Billing policy

**Assumptions**, all configurable from **Settings** rather than hard-coded:

- Bills are raised monthly, one per occupied flat
- The due date defaults to the 15th of the month
- The late-payment penalty is 2% of the invoice sub-total
- The grace period is 5 days after the due date
- Vacant flats are not billed
- A flat can be billed only once per period (a database constraint)

### A-11 · SLA targets

**Assumption:** the SRS requires SLA monitoring but does not state the targets.
These are used, defined in `lib/validations/complaint.ts`:

| Priority | Target | Typical case |
|---|---|---|
| Critical | 4 hours | Lift entrapment, major leak, fire risk |
| High | 12 hours | No water, unsafe wiring, security issue |
| Medium | 48 hours | Blocked drain, corridor light out |
| Low | 96 hours | Cosmetic repairs, minor requests |

### A-12 · Emergency siren

**Assumption:** browsers block audio that plays without user interaction, so a
siren that fires on its own is not achievable on the web. The SRS asks for an
"Interactive Emergency Siren/Alert", and the word *interactive* is taken at face
value: the alert banner appears automatically on every signed-in device, and the
siren is offered as a clearly-labelled **Sound siren** button. The tone is
generated with the Web Audio API, so no audio file is needed and the siren works
offline.

### A-13 · Gate configuration

**Assumption:** two gates, "Main Gate" and "Service Gate". Guards are posted to
one via `StaffProfile.gateAssignment`, which pre-selects it on the verification
screen. The gate is stored as text on each log rather than as a table, because
nothing else in the system needs to reference a gate as an entity.

### A-14 · Password policy

**Assumption:** minimum 8 characters with an uppercase letter, a lowercase
letter and a digit. No forced rotation — rotation without a breach signal is now
widely considered to weaken password quality rather than improve it.

### A-15 · Session lifetime

**Assumption:** 8 hours, which matches a security guard's shift. Configurable
via `AUTH_SESSION_TTL`.

### A-16 · Data retention

**Assumption:** nothing financial or security-related is ever hard-deleted.
Offboarding a resident soft-deletes their profile and deactivates their login
while preserving every bill, payment, complaint and gate log. Audit entries are
never deleted at all.

---

## Known limitations

Stated plainly rather than left for the reader to discover.

### L-1 · In-memory rate limiting

`lib/rate-limit.ts` keeps counters in process memory. Behind a load balancer
with multiple instances, each would keep its own counters and the effective
limit would multiply. A single-process deployment — what the SRS's hardware
section describes — is unaffected. Redis is the standard fix and the module has
a single, small interface.

### L-2 · No background job runner

See A-7. Housekeeping runs on page load, so a society with no dashboard traffic
for a long period would see overdue statuses lag until someone opens a page.
Nothing incorrect results — the underlying due dates are always accurate — but
a derived status can be briefly stale.

### L-3 · Uploads on an ephemeral filesystem

See A-4. On Vercel or a similar platform, `uploads/` does not persist across
deploys.

### L-4 · Chromium-only end-to-end tests

The Playwright suite runs on Chromium. The application uses no browser-specific
APIs, and the one capability that varies — camera access for QR scanning —
degrades to keypad entry. Firefox and Safari were checked by hand.

### L-5 · No visual regression or load testing

See [Testing §11.6](./testing.md#116-what-is-not-covered).

### L-6 · Notification fan-out is not batched for very large societies

Broadcasting an emergency alert inserts one notification row per active user in
a single `createMany`. At tens of thousands of users this would be better queued
and chunked.

### L-7 · Demo credentials are documented

The demo accounts are listed in the README, on the sign-in page and in this
documentation, because the SRS requires user credentials for all types of users
as a deliverable (§1.9). They must be removed before any real deployment.

---

## Deliberate scope exclusions

Not attempted, because the SRS does not ask for them:

- Native mobile applications (the web app is mobile-first and responsive)
- Integration with boom barriers, biometric readers or CCTV
- Accounting-system integration (Tally, QuickBooks)
- Rental agreement or document management
- Society accounting beyond maintenance collection (vendor payments, ledgers)
- Multi-language support

---

## Future improvements

In rough priority order:

1. **TOTP second factor** — completes FR-R1 (see A-1)
2. **Redis-backed rate limiting and job scheduling** — removes L-1 and L-2
3. **Object storage for uploads** — removes L-3
4. **SMS/email notification adapters** — extends A-5
5. **Visitor photograph capture at the gate** — completes A-2
6. **Server-sent events for the alert banner** — reduces alert latency to
   near-instant
7. **Multi-society tenancy** — the schema is already shaped for it (A-8)
8. **Automated accessibility and visual regression testing in CI**
