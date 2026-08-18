# 13. User Guide

A walkthrough for each of the four roles. Sign-in credentials are in
[Installation](./installation.md#demo-credentials).

---

## 13.1 Signing in

1. Open <http://localhost:3000> and press **Sign in** (or go straight to
   `/login`).
2. Enter your email address *or* your username, and your password.
3. Press **Sign in**. You land on the console for your role.

On the demo build, the sign-in page lists four accounts — clicking one fills the
form.

**If you cannot sign in:** the message is deliberately the same whether the
account does not exist or the password is wrong, so nobody can use the login
form to discover which addresses are registered. After eight consecutive failed
attempts an account locks for fifteen minutes.

---

## 13.2 Resident guide

Your dashboard opens with what needs your attention: money owed, open tickets,
active visitor passes and upcoming bookings.

### Creating a visitor pass

1. **Visitor Passes → New pass**.
2. Choose the visitor type — Guest, Delivery, Cab, Vendor, Service or Other.
3. Enter the name and mobile number. Add the vehicle number if they are driving;
   it helps the guard at the barrier.
4. Set the visit window. It defaults to now until four hours later.
5. For a vendor who will come and go, raise the number of entries.
6. Press **Create pass**.

You get a QR code and a **6-digit gate code**. Share either:

- **Copy code** puts the six digits on your clipboard.
- **Send the code by SMS** opens your messaging app with the details pre-filled.
- **Download pass** produces a printable A5 PDF with the QR on it.

You are notified the moment your visitor is cleared at the gate.

> Cancel a pass any time before it is used. Once a visitor has entered on it,
> the pass is part of the security record and cannot be withdrawn.

### Paying a maintenance bill

1. **Maintenance Bills** lists every invoice for your flat, newest first.
2. Open one to see the full breakdown — maintenance, water, security, common
   electricity, repairs, sinking fund, and any late-payment penalty.
3. Press **Pay now**, choose a method, and optionally tick *Pay a part of the
   amount*.
4. On success, download the receipt.

Past receipts are always available under **Payment History**.

> Payment processing is simulated in this build, as the specification requires.
> The receipt, transaction reference and accounting are all real; only the money
> movement is not.

### Raising a complaint

1. **Complaints → Raise a ticket**.
2. Give it a short title, choose a category and say where in the flat or
   building it is.
3. Choose the urgency. This sets the response target:

   | Priority | Target | Use for |
   |---|---|---|
   | Critical | 4 hours | A safety risk right now |
   | High | 12 hours | Something affecting daily use |
   | Medium | 48 hours | Needs attention this week |
   | Low | 96 hours | Can wait a few days |

4. Describe the problem. Say when it started, what you have already tried, and
   when someone can access the flat.
5. Attach up to four photos — a photo usually resolves a ticket faster.
6. Press **Raise the ticket**.

**Tracking it.** The ticket page shows a badge — *On track*, *Due soon* or *SLA
breached* — and a timeline of every update. Add a note at any time to give the
technician more information. Once it is resolved you can rate the work from one
to five stars.

> For a fire, a lift entrapment or a major leak, call the security desk first.
> The numbers are on your **Emergency Contacts** page. Do not wait on a ticket.

### Booking an amenity

1. **Amenity Booking**, then pick a facility from the list on the left.
2. Choose a date. Availability is live — taken slots are greyed out and show
   which flat holds them, and your own bookings are marked.
3. Select a free slot, a duration and how many people are coming.
4. Press **Confirm booking**.

The Clubhouse and Party Hall need committee approval, so those show **Request
booking** instead and you are notified when a decision is made.

Cancel free of charge up to the amenity's cancellation window — four hours for
most facilities. After that, contact the society office.

### Notices, polls and guidelines

- **Notice Board** — announcements, with upcoming events listed separately.
- **Polls & Voting** — you may vote once per poll. Results appear when the poll
  closes, or live if the committee enabled that.
- **Guidelines** — the society rulebook.
- **Emergency Contacts** — the society directory plus your own contacts. Every
  number is a tap-to-dial link.

### Your flat

**My Flat** shows the unit, everyone registered to it, and your household
members — keep that list current so the security desk can verify who belongs.
**Vehicles** is where you register cars and two-wheelers, which is what stops a
correctly-parked car being wheel-locked.

---

## 13.3 Security guard guide

The gate console is built for a tablet. Two large buttons at the top cover
almost everything you do.

### Verifying a pass

1. Press **Verify a gate pass**.
2. Either:
   - **Scan** — press *Scan*, then *Start camera*, and hold the visitor's QR
     code inside the frame; or
   - **Keypad** — type the 6-digit code the visitor reads out.
3. Press **Verify pass**.

**If the pass is valid**, the screen turns green and shows the visitor, the flat
they are visiting, the host's name and phone number, the vehicle and how many
entries remain. Press **Allow entry**. The resident is notified immediately.

**If it is not**, the screen turns red and tells you exactly why:

| Message | What to do |
|---|---|
| *No gate pass matches this code* | Ask them to check the code, or log a walk-in entry |
| *This pass is not valid yet* | The window opens later — the time is shown |
| *This pass expired at …* | Ask the resident to issue a new one |
| *The resident cancelled this pass* | Do not admit |
| *This single-entry pass has already been used* | Call the resident to confirm |
| *This visitor is already recorded inside* | Record their exit before scanning again |

**Refusing entry.** Press **Refuse**, type a short reason, and press **Record
refusal**. The resident is told, and the reason is kept on the record.

### Logging a walk-in visitor

For anyone arriving without a pass:

1. Press **Log a walk-in visitor**.
2. Type a flat number or a resident's name and pick the flat. Use the **Call**
   button to confirm with the resident.
3. Choose the visitor type and enter their name and mobile number.
4. Add the vehicle number, company and ID proof where relevant.
5. Set the expected exit time — an overstay alert is raised after it.
6. Press **Record entry**.

> After 10 PM, society rules require a valid gate pass. Always call the flat
> before admitting anyone at night.

### Recording exits

From the dashboard or the **Visitor Log**, press **Record exit** next to the
visitor. Confirm, and the exit time is stamped.

### Overstays

Anyone still inside past their expected exit appears in a red panel at the top
of your dashboard. Check on them, then either record their exit or let the
society office know.

### Reference screens

- **Expected Today** — everyone residents have pre-approved, with their gate
  codes ready.
- **Vehicle Register** — search a registration number to find its flat and call
  the owner about a blocked or wrongly-parked vehicle.
- **Alerts** — active and past emergency broadcasts.
- **Directory** — emergency numbers, one tap to dial.

---

## 13.4 Maintenance staff guide

Your dashboard is a queue, ordered by which ticket is due soonest.

### Working a ticket

1. Open a ticket from **My queue** or **Assigned Tickets**.
2. Read what the resident reported and look at their photos.
3. Call them using the button in the *Resident contact* panel if you need
   access or more detail.
4. When you have done something, record it:
   - **Change status** — move the ticket and add a work note.
   - **Add a work note** — record progress without changing the status.

**Public and internal notes.** A note is visible to the resident unless you tick
*Internal note*. Use an internal note for anything the resident does not need —
a part being out of stock, a note for a colleague.

**Resolving.** Set the status to *Resolved* and write a resolution summary
saying what you did. The resident is notified and can rate the work.

Only the society office can close a ticket, after the resident confirms.

**Completed Work** shows everything you have resolved, whether it met its
target, and your average resident rating.

---

## 13.5 Administrator guide

### The dashboard

Occupancy, collection, security and helpdesk in one view, with a six-month
billing chart, an occupancy breakdown, the newest tickets, recent gate activity
and the oldest outstanding dues.

### Managing flats and residents

**Flats & Units** has two views. The **Unit list** is for editing — create
blocks and flats, set the per-flat maintenance charge, change occupancy. The
**Occupancy map** draws each tower floor by floor; hover any unit to see its
residents and vehicles.

**Onboarding a resident:** *Residents → Onboard resident*. Enter their details,
choose the flat and whether they are an owner or a tenant. Leave the password
blank and the system generates a temporary one — **it is shown once and never
again**, so copy it before closing the dialog.

**Offboarding:** press the sign-out icon next to a resident. This deactivates
their login, signs them out everywhere, cancels their active gate passes,
promotes another resident to primary if there is one, and marks the flat vacant
if there is not. All their billing and gate history is preserved, and you are
warned if the flat has unsettled invoices.

### Running the billing cycle

1. **Maintenance Bills → Generate bills**.
2. Choose the month, year and due date.
3. Review the common charges — water, security, common electricity, repairs,
   sinking fund. Edit amounts, add or remove lines. Each flat's own maintenance
   charge is added on top automatically.
4. Optionally restrict the run to one block.
5. Press **Generate invoices**.

Flats already billed for that period are skipped, so re-running is safe.

**Penalties.** Press **Apply penalties** to add the society's late-payment
charge to every invoice past its due date plus the grace period. A bill that has
already been penalised is skipped, so this is also safe to repeat. Both the
percentage and the grace period are set under **Settings**.

**Collection.** The tiles show billed, collected, outstanding and penalties.
**Reports** breaks collection down by block.

### Routing complaints

**Complaints** is the queue. Filter by *Unassigned* to find what needs routing.

Open a ticket and the assignment panel ranks technicians by department match and
then by who has the lightest load, badging the best fit. Pick one, adjust the
priority if the resident under- or over-stated it, add a note, and assign. Both
the technician and the resident are notified.

You can move a ticket to any status, and only you can close one.

### Security oversight

- **Gate Logs** — every entry, exit and refusal, filterable by status, gate and
  verification method, with a seven-day traffic chart.
- **Visitors** — every pass issued, with its status and usage.
- Overstaying visitors are counted on the dashboard and flagged to guards.

### Broadcasting an emergency alert

1. **Emergency Alerts → Broadcast alert**.
2. Choose the type. The severity, headline, message and instructions are filled
   in from a template so you are not writing prose under pressure — edit them as
   needed.
3. Optionally restrict it to one block, and choose whether to offer a siren.
4. Press **Broadcast now**.

Within seconds every signed-in device shows a full-width banner with your
message and instructions, and everyone gets an urgent notification. Where the
siren is enabled, a **Sound siren** button appears on the banner — browsers do
not allow sound to start on its own, so it is offered rather than forced.

**Resolve the alert as soon as the situation is under control.** Add a closing
note; the banner clears for everyone.

### Notices and polls

**Notices** — publish immediately or schedule for later, set an expiry, pin
important ones, target residents, owners, tenants or staff, and attach event
details. Markdown headings, lists and bold are supported.

**Polls** — write the question and its context, add two to ten options, set the
window, and choose whether to show results live. Once voting starts the options
are locked, so a tally can never be invalidated. Each resident may vote once,
enforced by the database.

### Audit log

**Audit Log** is an append-only record of every significant action — sign-ins,
gate verifications, entries and exits, bill generation, penalties, payments,
complaint assignments and status changes, bookings, notices, polls, emergency
broadcasts and settings changes. Nothing in the application can edit or delete
an entry. Filter by category, actor role, or free text.

### Settings

- **Society & billing** — name, address, contact details, penalty percentage and
  grace period. These appear on generated invoices, receipts and gate passes.
- **Guidelines** — the rulebook residents read.
- **Emergency directory** — the numbers residents and guards see, in the order
  you set.

---

## 13.6 Shared account pages

Available to every role from the avatar menu.

- **My Profile** — name, email, phone, occupation.
- **Notifications** — the full inbox, filterable by unread.
- **Security** — change your password (which signs you out of every other
  device), review active sessions, and see recent sign-in activity.
