# 8. Workflows — Activity Diagrams & Flowcharts

## 8.1 Authentication and role routing

```mermaid
flowchart TD
    S([Start]) --> A["Open /login"]
    A --> B["Enter email or username<br/>and password"]
    B --> C{Rate limit<br/>exceeded?}
    C -- yes --> C1["Show retry-after message"] --> B
    C -- no --> D{Account<br/>exists?}
    D -- no --> E["Generic failure:<br/>'Invalid email/username or password'<br/>audit auth.login.failed"] --> B
    D -- yes --> F{Locked?}
    F -- yes --> F1["Show lockout with<br/>minutes remaining"] --> B
    F -- no --> G{Password<br/>matches?}
    G -- no --> H["Increment failure count<br/>lock after 8 attempts<br/>audit auth.login.failed"] --> E
    G -- yes --> I{Account<br/>ACTIVE?}
    I -- no --> I1["'Contact the society administrator'"] --> B
    I -- yes --> J["Reset failure count<br/>stamp lastLoginAt"]
    J --> K["Create session row<br/>+ signed HTTP-only cookie"]
    K --> L["audit auth.login.success"]
    L --> M{Role}
    M -- ADMIN --> N1["/admin"]
    M -- RESIDENT --> N2["/resident"]
    M -- GUARD --> N3["/guard"]
    M -- MAINTENANCE_STAFF --> N4["/staff"]
    N1 & N2 & N3 & N4 --> Z([End])
```

## 8.2 Visitor verification flow

The society's most latency-sensitive path.

```mermaid
flowchart TD
    S([Visitor arrives]) --> A{Has a pass?}
    A -- no --> W1["Guard opens Walk-in entry"]
    W1 --> W2["Search the flat,<br/>confirm with the resident"]
    W2 --> W3["Capture name, phone, type,<br/>vehicle, ID proof"]
    W3 --> W4["Create Visitor + GateLog INSIDE<br/>method = MANUAL"]
    W4 --> N["Notify the host flat"] --> Z([Visitor admitted])

    A -- yes --> B["Guard opens Verify pass"]
    B --> C{Scan or type?}
    C -- scan --> C1["Camera decodes the QR"]
    C -- type --> C2["Keypad: 6-digit gate code"]
    C1 & C2 --> D["Resolve pass by<br/>qrToken / passCode / gateCode"]

    D --> E{Found?}
    E -- no --> X1["DENY · code not recognised<br/>suggest walk-in entry"] --> W1

    E -- yes --> F{Cancelled or<br/>previously refused?}
    F -- yes --> X2["DENY · show the reason"] --> Y

    F -- no --> G{validFrom<br/>in the future?}
    G -- yes --> X3["DENY · becomes active at …"] --> Y

    G -- no --> H{validUntil<br/>in the past?}
    H -- yes --> X4["Mark pass EXPIRED<br/>DENY · expired at …"] --> Y

    H -- no --> I{entriesUsed<br/>&ge; maxEntries?}
    I -- yes --> X5["DENY · all entries used"] --> Y

    I -- no --> J{Visitor already<br/>recorded inside?}
    J -- yes --> X6["DENY · record an exit first"] --> Y

    J -- no --> K["ALLOW · show visitor,<br/>host flat and host contact"]
    K --> L{Guard's<br/>decision}
    L -- refuse --> M1["Capture a reason<br/>GateLog DENIED · pass REJECTED<br/>notify the host"] --> Y
    L -- allow --> M2["GateLog INSIDE<br/>entriesUsed + 1<br/>audit gate.entry"]
    M2 --> M3["Notify the host:<br/>'Your visitor has arrived'"] --> Z

    Y([Entry refused])

    Z --> E1["Visitor leaves"]
    E1 --> E2["Guard records exit<br/>GateLog EXITED · audit gate.exit"]
    E2 --> E3([Complete])

    Z -.-> O1{Past expected<br/>exit time?}
    O1 -- yes --> O2["Flag OVERSTAY<br/>notify the host and administrators"]
```

## 8.3 Billing lifecycle

```mermaid
flowchart TD
    S([Start of the month]) --> A["Admin opens Generate bills"]
    A --> B["Choose period, due date<br/>and common charge lines"]
    B --> C["For each occupied flat<br/>with a resident"]
    C --> D{Already billed<br/>for this period?}
    D -- yes --> D1["Skip and report"] --> G
    D -- no --> E["baseAmount = flat.baseMaintenance<br/>+ Σ common charges"]
    E --> F["Create MaintenanceBill<br/>+ one BillCharge per component"]
    F --> G{More flats?}
    G -- yes --> C
    G -- no --> H["Notify every billed flat<br/>audit bill.generated"]

    H --> I(["Invoice is UNPAID"])
    I --> J{Resident pays<br/>before the due date?}
    J -- yes --> K["Simulate payment"] --> L["Recalculate paidAmount<br/>PAID or PARTIALLY_PAID"]
    L --> M["Generate receipt number<br/>+ transaction reference"]
    M --> N["Notify the flat<br/>audit payment.simulated"] --> Z([Settled])

    J -- no --> O["refreshOverdueStatuses()<br/>marks it OVERDUE"]
    O --> P{Past the<br/>grace period?}
    P -- no --> J
    P -- yes --> Q["Admin applies penalties"]
    Q --> R["penaltyAmount = baseAmount × penaltyPercent<br/>add a PENALTY charge line<br/>totalAmount recalculated"]
    R --> S2["audit bill.penalty.applied"] --> J
```

## 8.4 Complaint lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING : Resident raises a ticket<br/>(SLA clock starts)

    PENDING --> IN_PROGRESS : Admin assigns a technician<br/>(first response recorded)
    PENDING --> RESOLVED : Fixed immediately
    PENDING --> CLOSED : Admin closes it

    IN_PROGRESS --> RESOLVED : Technician records the fix
    IN_PROGRESS --> PENDING : Returned to the queue
    IN_PROGRESS --> CLOSED : Admin closes it

    RESOLVED --> CLOSED : Admin closes after confirmation
    RESOLVED --> IN_PROGRESS : Reopened — the fix did not hold<br/>(resolvedAt cleared)

    CLOSED --> [*]

    note right of PENDING
        slaDueAt = created + priority hours
        CRITICAL 4h · HIGH 12h
        MEDIUM 48h · LOW 96h
    end note

    note right of RESOLVED
        The resident can rate the work 1–5
    end note
```

### Complaint activity flow

```mermaid
flowchart TD
    S([Resident notices a problem]) --> A["Raise a ticket:<br/>title, category, priority,<br/>description, photos"]
    A --> B["Validate input<br/>and each photo (type, magic bytes, size)"]
    B --> C["Create ticket · PENDING<br/>compute slaDueAt<br/>open the status history"]
    C --> D["Notify administrators<br/>audit complaint.created"]

    D --> E["Admin reviews the queue"]
    E --> F["Assignment panel ranks technicians:<br/>department match, then lightest workload"]
    F --> G["Assign · IN_PROGRESS<br/>notify technician and resident"]

    G --> H["Technician opens the ticket"]
    H --> I{Can it be<br/>fixed now?}
    I -- no --> J["Add a work note<br/>(public or internal)"] --> H
    I -- yes --> K["Set RESOLVED with<br/>a resolution summary"]
    K --> L["Notify the resident<br/>audit complaint.status.changed"]

    L --> M{Resident<br/>satisfied?}
    M -- no --> N["Resident adds a note<br/>admin reopens · IN_PROGRESS"] --> H
    M -- yes --> O["Resident rates the work 1–5"]
    O --> P["Admin closes the ticket"] --> Z([Closed])
```

## 8.5 Amenity booking flow

```mermaid
flowchart TD
    S([Resident wants a facility]) --> A["Open Amenity booking"]
    A --> B["Select an amenity"]
    B --> C["Pick a date within<br/>the advance-booking window"]
    C --> D["Server renders the slot grid:<br/>free · taken · past · mine"]
    D --> E["Select a slot,<br/>duration and guest count"]
    E --> F{Slot-grid<br/>aligned?}
    F -- no --> F1["Refuse · choose a listed slot"] --> D
    F -- yes --> G{Ends before<br/>closing time?}
    G -- no --> G1["Refuse · closes before that"] --> D
    G -- yes --> H{Within<br/>capacity?}
    H -- no --> H1["Refuse · capacity is N"] --> E
    H -- yes --> I["BEGIN SERIALIZABLE TRANSACTION"]
    I --> J{Overlapping booking<br/>for this amenity?}
    J -- yes --> J1["ROLLBACK · slot just taken"] --> D
    J -- no --> K{Resident has an<br/>overlapping booking?}
    K -- yes --> K1["ROLLBACK · you already have one"] --> D
    K -- no --> L["Create the booking"]
    L --> M{Amenity requires<br/>approval?}
    M -- yes --> N1["Status PENDING<br/>notify the resident"] --> O["Admin approves or rejects"]
    M -- no --> N2["Status CONFIRMED"]
    O --> P{Decision}
    P -- approve --> N2
    P -- reject --> P1["CANCELLED with a reason<br/>notify the resident"] --> Z
    N2 --> Q["Notify · audit booking.created"] --> Z([Booked])

    Z --> R{Cancelled<br/>later?}
    R -- yes --> S2{Within the free<br/>cancellation window?}
    S2 -- no --> S3["Refuse · contact the office"]
    S2 -- yes --> S4["CANCELLED · slot released"]
    R -- no --> T["After the slot ends:<br/>COMPLETED"]
```

## 8.6 Emergency alert flow

```mermaid
flowchart TD
    S([Emergency occurs]) --> A["Admin opens Emergency alerts"]
    A --> B["Choose the alert type"]
    B --> C["Severity, headline, message<br/>and instructions pre-filled<br/>from a template"]
    C --> D["Edit as needed;<br/>optionally target one block;<br/>choose whether to offer a siren"]
    D --> E["Broadcast"]
    E --> F["Create EmergencyAlert · ACTIVE<br/>audit alert.broadcast"]
    F --> G["Create an urgent notification<br/>for every active user"]
    G --> H["Every signed-in client polls<br/>/api/notifications every 30 s"]
    H --> I["Full-width banner appears<br/>with the message and instructions"]
    I --> J{Siren offered?}
    J -- yes --> K["User presses 'Sound siren'<br/>Web Audio two-tone wail"]
    J -- no --> L["Banner only"]
    K & L --> M["Situation is handled"]
    M --> N["Admin resolves with a closing note"]
    N --> O["Status RESOLVED<br/>audit alert.resolved"]
    O --> P["Banner clears everywhere<br/>within one polling interval"] --> Z([Complete])
```

## 8.7 Resident journey

The journey named in SRS §1.6, end to end.

```mermaid
flowchart LR
    A(["1 · Login"]) --> B(["2 · Generate<br/>visitor pass"])
    B --> C(["3 · View<br/>monthly bill"])
    C --> D(["4 · Book the<br/>clubhouse"])
    D --> E(["5 · Log a<br/>plumbing ticket"])
    E --> F(["6 · Track<br/>the SLA"])

    A -.- A1["/login<br/>role-routed to /resident"]
    B -.- B1["/resident/visitors/new<br/>QR + 6-digit gate code"]
    C -.- C1["/resident/bills/[id]<br/>itemised breakdown, PDF"]
    D -.- D1["/resident/amenities<br/>live slot grid"]
    E -.- E1["/resident/complaints/new<br/>category, priority, photos"]
    F -.- F1["/resident/complaints/[id]<br/>On track · Due soon · Breached"]
```

Covered end-to-end by `tests/e2e/resident-journey.spec.ts`.

## 8.8 Administrator journey

```mermaid
flowchart LR
    A(["1 · Login"]) --> B(["2 · Dashboard"])
    B --> C(["3 · Review<br/>monthly dues"])
    C --> D(["4 · Broadcast<br/>emergency notice"])
    D --> E(["5 · Assign<br/>helpdesk ticket"])
    E --> F(["6 · Audit security<br/>gate logs"])

    A -.- A1["/login → /admin"]
    B -.- B1["/admin<br/>occupancy, collection, security, helpdesk"]
    C -.- C1["/admin/bills<br/>outstanding, overdue, penalties"]
    D -.- D1["/admin/alerts<br/>society-wide banner + siren"]
    E -.- E1["/admin/complaints/[id]<br/>ranked technician recommendation"]
    F -.- F1["/admin/security · /admin/audit<br/>entry/exit logs, immutable trail"]
```

Covered end-to-end by `tests/e2e/gate-and-admin.spec.ts`.

## 8.9 Resident onboarding and offboarding

```mermaid
flowchart TD
    subgraph Onboarding
        A1["Admin opens Residents → Onboard"] --> A2["Enter details, choose flat and type"]
        A2 --> A3{Password<br/>supplied?}
        A3 -- no --> A4["Generate a temporary password"]
        A3 -- yes --> A5["Use the supplied password"]
        A4 & A5 --> A6["Create the user (bcrypt hash)<br/>+ resident profile"]
        A6 --> A7["Flat → OCCUPIED,<br/>occupancyType set"]
        A7 --> A8{Primary<br/>contact?}
        A8 -- yes --> A9["Demote any existing primary"]
        A8 -- no --> A10["Keep the current primary"]
        A9 & A10 --> A11["Welcome notification<br/>audit resident.created"]
        A11 --> A12["Show the temporary password once"]
    end

    subgraph Offboarding
        B1["Admin opens Offboard"] --> B2["Set move-out date and reason"]
        B2 --> B3["Soft-delete the profile<br/>user → INACTIVE"]
        B3 --> B4["Revoke every session"]
        B4 --> B5["Cancel active gate passes"]
        B5 --> B6{Other residents<br/>in the flat?}
        B6 -- no --> B7["Flat → VACANT"]
        B6 -- yes --> B8["Promote the longest-standing<br/>resident to primary"]
        B7 & B8 --> B9["Warn if invoices are unsettled<br/>audit resident.offboarded"]
    end
```

Billing and gate history are preserved throughout — offboarding never deletes a
financial or security record.
