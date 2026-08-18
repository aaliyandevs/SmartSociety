# 1. Problem Definition

## 1.1 Background and necessity

Modern housing societies and gated communities face substantial administrative
challenges in manually managing resident records, security checkpoints,
maintenance collection, visitor approvals and facility bookings.

The traditional approach relies on:

- **A paper gate register.** A guard writes the visitor's name, flat number and
  time in a ledger. Handwriting is often illegible, the register is rarely
  audited, and there is no way to confirm afterwards that a resident actually
  approved a visitor. Nothing prevents a visitor from writing a fictitious flat
  number.
- **Fragmented communication.** Complaints arrive by WhatsApp, phone call or a
  note slipped under the office door. There is no ticket number, no owner, no
  deadline and no history — so the same issue is reported repeatedly and the
  committee cannot tell how long anything takes to fix.
- **Manual maintenance collection.** Bills are computed in a spreadsheet, printed
  and slipped under doors. Payment is tracked in a second spreadsheet.
  Reconciling the two is slow, and overdue amounts drift because nobody has a
  reliable, current view of who owes what.
- **Ad-hoc amenity booking.** The clubhouse is booked over a phone call to the
  society office. Double bookings happen, and a resident cannot see availability
  without calling.
- **No audit trail.** When a dispute arises — a disputed penalty, an unauthorised
  entry, a complaint that "was never received" — there is no record to consult.

### Consequences

| Problem | Operational consequence |
|---|---|
| Unverifiable visitor entries | Security vulnerability; no accountability after an incident |
| No ticket tracking | Operational delays; repeat complaints; no SLA measurement |
| Spreadsheet-based billing | Untracked financial dues; disputes over penalties |
| Verbal amenity booking | Double bookings; disputes; no usage data |
| No audit records | Poor transparency between the management board and residents |

As residential complexes grow to hundreds or thousands of apartments, these
problems scale faster than the committee's capacity to absorb them manually.

## 1.2 Proposed solution

**SmartSociety** is a comprehensive web-based Housing Society Management System
that centralises administration, visitor security, maintenance billing,
complaint resolution and facility booking behind role-based interfaces tailored
for four distinct kinds of user.

### How each problem is addressed

| Problem | SmartSociety's answer |
|---|---|
| Paper gate register | Residents issue **digital QR gate passes** with a time window. Guards scan the QR or type a 6-digit code; the system decides whether entry is allowed and stamps the record automatically. |
| Fragmented complaints | A **helpdesk** with ticket numbers, categories, priorities, photo attachments, assigned technicians and a service-level target that everyone can see. |
| Manual billing | A **billing engine** that generates one itemised invoice per occupied flat, applies overdue penalties by policy, and produces downloadable PDF receipts. |
| Verbal amenity booking | A **slot-based booking calendar** with real-time availability, where the database itself makes a double booking impossible. |
| No audit trail | An **append-only audit log** covering gate verifications, complaint status changes, and administrative financial edits. |
| Slow emergency communication | A **broadcast alert** that appears as a full-width banner on every signed-in device within seconds, with an optional audible siren. |

### The four roles

| Role | Who they are | What the system gives them |
|---|---|---|
| **Administrator** | The managing committee and society office | Full operational and financial control: residents, flats, billing, helpdesk routing, security oversight, communication, audit |
| **Resident** | Owners and tenants | Bills and receipts, visitor passes, complaints, amenity bookings, notices, polls, emergency contacts |
| **Security Guard** | Gate personnel | A fast, simple gate console: verify, log walk-ins, record exits, act on overstays |
| **Maintenance Staff** | Technicians | A focused queue of assigned tickets with status updates and work notes |

## 1.3 Purpose of this document set

This documentation defines the functional and non-functional requirements
implemented by SmartSociety and records the design decisions taken. It serves
developers, system architects and society stakeholders, and details the scope,
architectural specification, database schema and operational constraints
governing the implementation.

## 1.4 Scope of the project

### In scope

SmartSociety is a fully responsive, secure web platform accessible across
desktop and mobile browsers.

**Residents can:**
- View current and historical maintenance invoices, see the breakdown of charges
  (maintenance, water, security, repairs, common electricity, sinking fund,
  penalties), download PDF receipts and simulate digital fee payment
- Log maintenance complaints with photo uploads, category tagging and status
  tracking
- Request visitor entry passes with custom time windows for guests, delivery
  drivers and cab operators
- Book shared amenities such as the clubhouse and tennis courts
- Participate in digital community voting and read notices
- Manage their flat profile: vehicles, family/tenant details, emergency contacts

**Society administrators can:**
- Onboard and offboard residents, tenants and owners, and maintain a flat
  occupancy status map
- Generate automated monthly maintenance bills and apply penalties on overdue
  balances
- Oversee visitor logs and real-time entry/exit records for all gates
- Assign work tickets to maintenance staff and monitor resolution SLAs
- Broadcast emergency notices and manage the notice board and polls
- Review an immutable audit log and operational reports

**Security personnel can:**
- Log incoming guests and delivery vendors with photograph, vehicle number,
  target flat and entry timestamp
- Verify resident-generated visitor QR codes or numeric gate keys in real time
- Receive alerts for unapproved extended vendor stays

**Maintenance staff can:**
- Work a queue of assigned tickets ordered by service-level deadline
- Update status, add public or internal work notes and record resolutions

### Explicitly simulated

Per SRS §1.4, **payment gateway processing and automated banking reconciliation
are simulated** for scope compliance. A payment produces a real payment record,
a receipt number and a transaction reference — exactly as a live gateway would —
but no money moves and no bank is contacted. Every simulated payment is flagged
as such in the database (`payments.simulated = true`) and labelled as such in the
user interface.

### Out of scope

- Native mobile applications (the web application is mobile-first and responsive)
- SMS and email delivery of notifications (in-app notifications are implemented)
- Multi-factor authentication beyond password (see
  [Assumptions](./assumptions.md))
- Integration with physical boom barriers, biometric readers or CCTV systems
- Accounting-system integration (Tally, QuickBooks and similar)

## 1.5 Constraints

| Constraint | How it is met |
|---|---|
| **Browser compatibility** — Chrome, Edge, Safari, Firefox | Standard web platform features only; no browser-specific APIs. The QR scanner degrades gracefully to keypad entry where camera access is unavailable. |
| **Responsiveness** — mobile-first layouts for security desk tablets, handheld phones and desktop screens | Tailwind CSS breakpoints from 320 px upward; the guard console uses a comfortable density with large touch targets; every wide table scrolls inside its own container so the page never overflows horizontally. |
| **Real-time security verification** — gate pass verification under 2 seconds | Verification is a single indexed database lookup with no external calls. Measured locally at well under 100 ms; see [Testing](./testing.md#performance). |
