# 10. API Reference

SmartSociety exposes two kinds of server-side entry point:

- **Server actions** (`actions/*.ts`) — the write path. Called directly from
  forms; there is no hand-written fetch layer.
- **Route handlers** (`app/api/**`) — used only where the response is not HTML:
  PDF documents, authenticated file streaming, and the notification poll.

Every entry point follows the same discipline:

```
authenticate → authorise → rate-limit → validate → domain service
            → audit → notify → revalidate → typed result
```

## 10.1 The action result contract

All server actions return one shape, consumed by `useActionState` on the client:

```ts
type ActionState<TData = undefined> =
  | { status: 'idle' }
  | { status: 'success'; message: string; data?: TData }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string[]> }
```

Errors are classified before they leave the server:

| Thrown | Becomes | HTTP-equivalent |
|---|---|---|
| `ZodError` | `error` with `fieldErrors` | 422 |
| `UnauthorizedError` | `error` | 401 |
| `ForbiddenError` | `error` | 403 |
| `NotFoundError` | `error` | 404 |
| `ConflictError` | `error` | 409 |
| `RateLimitError` | `error` with retry-after wording | 429 |
| anything else | generic `error`, logged server-side | 500 |

A raw stack trace never reaches the client.

---

## 10.2 Authentication — `actions/auth-actions.ts`

### `loginAction(prev, formData)`

| Field | Type | Rules |
|---|---|---|
| `identifier` | string | Email address or username, 3–120 chars |
| `password` | string | Required |
| `next` | string | Optional post-login destination; only same-origin relative paths are honoured |

**Rate limits:** 8 per identifier / 5 min · 25 per IP / 5 min
**Audit:** `auth.login.success`, `auth.login.failed`
**On success:** creates a session row, sets the cookie and redirects to the
role's home (or the validated `next`).

### `logoutAction()`

Revokes the session row, clears the cookie, audits `auth.logout`, redirects to
`/login`.

### `changePasswordAction(prev, formData)`

| Field | Rules |
|---|---|
| `currentPassword` | Must match |
| `newPassword` | ≥ 8 chars, upper + lower + digit, different from the current one |
| `confirmPassword` | Must equal `newPassword` |

**Side effect:** every other session for the user is revoked.
**Audit:** `auth.password.changed`

---

## 10.3 Visitors and the gate — `actions/gate-actions.ts`

### `createGatePassAction` · Resident

| Field | Type | Rules |
|---|---|---|
| `visitorName` | string | 2–80 chars |
| `visitorPhone` | string | 11-digit Pakistani mobile |
| `visitorType` | enum | GUEST · DELIVERY · CAB · VENDOR · SERVICE · OTHER |
| `vehicleNumber` | string? | Normalised, e.g. `LEA1234` |
| `company` | string? | ≤ 80 chars |
| `purpose` | string? | ≤ 200 chars |
| `validFrom` / `validUntil` | datetime | End after start, not already elapsed, ≤ 30 days |
| `maxEntries` | int | 1–10 |

**Returns:** `{ passId }` · **Rate limit:** 20/hour · **Audit:** `gatepass.created`
**Notifies:** the resident, and every guard ("expected today")

### `cancelGatePassAction` · Resident (own) or Admin

`{ passId, reason? }` — refuses if the pass has already been used.
**Audit:** `gatepass.cancelled`

### `verifyPassAction` · Guard or Admin

`{ code, method }` where `code` may be a QR payload, a pass code or a 6-digit
gate code.

**Returns**

```ts
{ outcome: 'GRANTED', pass: VerifiedPass }
| { outcome: 'DENIED', reason: string, detail: string, pass?: VerifiedPass }
```

`reason` ∈ `NOT_FOUND · INVALID · TOO_EARLY · EXPIRED · CANCELLED · REJECTED ·
ALREADY_USED · ALREADY_INSIDE`

**Read-only** — this never consumes an entry. **Rate limit:** 120/min
**Audit:** `gate.verification`

### `approveEntryAction` · Guard or Admin

`{ passId, gate, vehicleNumber?, expectedExitAt?, remarks?, method }`
Creates an `INSIDE` gate log inside a transaction that re-checks for a
concurrent entry. **Audit:** `gate.entry` · **Notifies:** the host flat

### `rejectEntryAction` · Guard or Admin

`{ passId, gate, reason }` — records a `DENIED` log, marks the pass `REJECTED`,
notifies the host flat urgently. **Audit:** `gate.verification`

### `logWalkInAction` · Guard or Admin

`{ name, phone, visitorType, flatId, vehicleNumber?, company?, idProofType?,
idProofNumber?, gate, expectedExitAt?, remarks? }`
**Rate limit:** 60 / 5 min · **Audit:** `visitor.logged`

### `recordExitAction` · Guard or Admin

`{ gateLogId, remarks? }` — refuses a duplicate exit or an exit against a
refused entry. **Audit:** `gate.exit`

### `flagOverstayAction(gateLogId)` · Guard or Admin

Marks the log `OVERSTAY` and notifies the host flat and all administrators.

### `searchFlatsAction(term)` · Guard or Admin

Returns up to 20 `{ id, label, resident, phone }` for the walk-in flat picker.

---

## 10.4 Billing — `actions/billing-actions.ts`

### `generateBillsAction` · Admin

| Field | Rules |
|---|---|
| `periodMonth` / `periodYear` | 1–12 / 2020–2100 |
| `dueDate` | date |
| `chargeType[]`, `chargeLabel[]`, `chargeAmount[]` | 1–12 repeated charge rows |
| `blockId` | optional restriction |
| `notes` | ≤ 300 chars |

**Returns:** `{ created }` and reports skipped flats.
**Rate limit:** 5 / 5 min · **Audit:** `bill.generated` · **Notifies:** every billed flat

### `applyPenaltiesAction` · Admin

`{ billId? }` — blank applies to every eligible overdue invoice. Idempotent: a
bill that already carries a penalty is skipped. **Audit:** `bill.penalty.applied`

### `simulatePaymentAction` · Resident (own flat) or Admin

| Field | Rules |
|---|---|
| `billId` | Must belong to the caller's flat when the caller is a resident |
| `method` | UPI · CARD · NETBANKING · WALLET · CASH · CHEQUE |
| `amount` | Optional; blank settles the full balance, and any figure is capped at it |

**Returns:** `{ paymentId, receiptNumber }` · **Rate limit:** 12 / 5 min
**Audit:** `payment.simulated` · **Notifies:** the flat

> Gateway processing and bank reconciliation are simulated (SRS §1.4).

### `cancelBillAction` · Admin

`{ billId, reason }` — refused once any payment exists. **Audit:** `bill.cancelled`

---

## 10.5 Complaints — `actions/complaint-actions.ts`

### `createComplaintAction` · Resident

| Field | Rules |
|---|---|
| `title` | 5–120 chars |
| `category` | 9 categories |
| `priority` | LOW · MEDIUM · HIGH · CRITICAL |
| `description` | 15–2000 chars |
| `location` | ≤ 120 chars |
| `photos` | Up to 4 images, ≤ 5 MB each, JPEG/PNG/WebP/HEIC verified by magic bytes |

**Returns:** `{ complaintId, ticketNumber }` · **Rate limit:** 10/hour
**Audit:** `complaint.created` · **Notifies:** all administrators

### `assignComplaintAction` · Admin

`{ complaintId, staffId, priority?, note? }` — moves a pending ticket to
`IN_PROGRESS` and re-bases the SLA if the priority changed.
**Audit:** `complaint.assigned` · **Notifies:** technician and resident

### `updateComplaintStatusAction` · Admin or assigned technician

`{ complaintId, status, note, isInternal?, resolutionNotes? }`
Technicians are restricted to their own tickets; only administrators may close.
**Audit:** `complaint.status.changed` · **Notifies:** the resident, unless the
note is internal

### `addComplaintNoteAction` · Admin, assigned technician, or the owning resident

`{ complaintId, note, isInternal? }` — residents can never post an internal note.
**Audit:** `complaint.note.added`

### `rateComplaintAction` · Resident

`{ complaintId, satisfaction }` — 1–5, only once the ticket is resolved or closed.

---

## 10.6 Amenities — `actions/amenity-actions.ts`

### `createBookingAction` · Resident

`{ amenityId, startsAt, slots, guestsCount, purpose? }`
Validated against the slot grid, capacity, closing time, advance window and both
kinds of overlap. **Rate limit:** 20/hour · **Audit:** `booking.created`

### `cancelBookingAction` · Resident (own) or Admin

`{ bookingId, reason? }` — residents are bound by the amenity's cancellation
window; administrators are not. **Audit:** `booking.cancelled`

### `reviewBookingAction` · Admin

`{ bookingId, decision, reason? }` for approval-required amenities.

### `saveAmenityAction` / `toggleAmenityAction` · Admin

Create or edit a facility; open or close it for bookings.
**Audit:** `amenity.created`, `amenity.updated`

---

## 10.7 Communication — `actions/community-actions.ts`

| Action | Access | Input | Audit |
|---|---|---|---|
| `saveNoticeAction` | Admin | title, content, category, priority, audience, publish/expiry, event, pinned, published | `notice.created` / `notice.updated` |
| `deleteNoticeAction` | Admin | `noticeId` (soft delete) | `notice.deleted` |
| `savePollAction` | Admin | title, description, options[], window, anonymity, live results, status | `poll.created` / `poll.updated` |
| `setPollStatusAction` | Admin | `{ pollId, status }` | `poll.updated` |
| `voteAction` | Resident | `{ pollId, optionId }` — one vote per poll, enforced by a unique index | `poll.voted` (choice not recorded) |
| `broadcastAlertAction` | Admin | type, severity, title, message, instructions, target block, siren | `alert.broadcast` |
| `resolveAlertAction` | Admin | `{ alertId, resolutionNote? }` | `alert.resolved` |

Editing a poll that already has votes leaves its options untouched, so a tally
can never be invalidated.

---

## 10.8 Society administration — `actions/society-actions.ts`

| Action | Input | Notes |
|---|---|---|
| `createBlockAction` | name, label, totalFloors | Unique per society |
| `saveFlatAction` | block, number, floor, type, area, occupancy, parking, maintenance | Refuses to mark a flat vacant while residents remain |
| `archiveFlatAction` | `flatId` | Requires no residents and no unsettled invoices |
| `onboardResidentAction` | name, email, phone, flat, type, primary, move-in, occupation, password? | Returns a one-time temporary password when none is supplied |
| `updateResidentAction` | + `residentId`, `status` | Moving a flat re-evaluates both units |
| `offboardResidentAction` | `residentId`, move-out date, reason | Deactivates the login, revokes sessions, cancels passes, promotes a new primary |
| `onboardStaffAction` / `updateStaffAction` | staff details | Setting a non-active status revokes their sessions |
| `updateSocietySettingsAction` | society identity, contact, penalty policy, guidelines | `settings.updated` |
| `saveDirectoryContactAction` / `deleteDirectoryContactAction` | emergency directory entries | |

---

## 10.9 Profile — `actions/profile-actions.ts`

| Action | Access | Notes |
|---|---|---|
| `updateProfileAction` | Any signed-in user | Email uniqueness re-checked |
| `saveVehicleAction` / `deleteVehicleAction` | Resident | Registration unique society-wide; count bounded by the flat's parking allotment |
| `saveFamilyMemberAction` / `deleteFamilyMemberAction` | Resident | Scoped to the caller's own profile |
| `saveEmergencyContactAction` / `deleteEmergencyContactAction` | Resident | Personal contacts only |

All queries are scoped by the caller's own `residentId`, so a forged identifier
returns "not found" rather than another household's record.

---

## 10.10 Route handlers

### `GET /api/notifications`

Polled every 45 s by the notification bell and every 30 s by the alert banner.

```json
{
  "unreadCount": 3,
  "notifications": [
    {
      "id": "clx…", "type": "BILL_GENERATED",
      "title": "Your maintenance bill is ready",
      "body": "Invoice INV-202603-A101 for Rs 4,430.00 is due on 15/03/2026.",
      "link": "/resident/bills", "isUrgent": false,
      "readAt": null, "createdAt": "2026-03-01T09:00:00.000Z"
    }
  ],
  "activeAlert": null
}
```

`401` when not signed in. `Cache-Control: no-store`.

### `GET /api/bills/[id]/receipt?payment=<id>`

Returns `application/pdf`. With `payment`, renders that receipt; without, the
most recent successful payment, or an invoice if nothing is paid.
Residents may only fetch their own flat's documents; guards and technicians are
refused outright.

### `GET /api/passes/[id]/pdf`

Returns a printable A5 gate pass with an embedded QR image. Accessible to the
host resident, any guard, or an administrator.

### `GET /api/files/[...key]`

Streams a complaint photo to the ticket's owner, its assigned technician, or an
administrator. Served with `X-Content-Type-Options: nosniff` and a restrictive
`Content-Security-Policy`, and never from a public directory.

---

## 10.11 Security headers

Set globally in `next.config.ts`:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=()` |

The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
`SameSite=Lax` is what blocks cross-site form posts, which is the CSRF vector
that matters for server actions.
