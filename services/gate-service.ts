import 'server-only';

import type { GatePassStatus, Prisma, VisitorType } from '@prisma/client';

import prisma from '@/lib/prisma';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import {
  generateGateCode,
  generatePassCode,
  generateQrToken,
} from '@/lib/codes';
import { formatDateTime } from '@/lib/utils';
import { parseScannedCode } from '@/services/qr-service';

/**
 * Visitor pre-approval and gate verification.
 *
 * SRS §1.6 — residents generate QR gate passes with custom time windows;
 * security personnel verify them for "instant access clearance" in under two
 * seconds (§1.5 Real-time Security Verification).
 */

// ── Pass creation ─────────────────────────────────────────────────────────────

export interface CreateGatePassInput {
  residentId: string;
  flatId: string;
  visitorName: string;
  visitorPhone: string;
  visitorType: VisitorType;
  vehicleNumber?: string | null;
  company?: string | null;
  purpose?: string | null;
  validFrom: Date;
  validUntil: Date;
  maxEntries: number;
}

export async function createGatePass(input: CreateGatePassInput) {
  if (input.validUntil <= input.validFrom) {
    throw new AppError('The visit window must end after it starts.', {
      fieldErrors: { validUntil: ['The visit window must end after it starts.'] },
    });
  }

  return prisma.$transaction(async (tx) => {
    const visitor = await tx.visitor.create({
      data: {
        flatId: input.flatId,
        name: input.visitorName,
        phone: input.visitorPhone,
        visitorType: input.visitorType,
        vehicleNumber: input.vehicleNumber ?? null,
        company: input.company ?? null,
      },
    });

    return tx.gatePass.create({
      data: {
        passCode: generatePassCode(),
        gateCode: generateGateCode(),
        qrToken: generateQrToken(),
        visitorId: visitor.id,
        flatId: input.flatId,
        residentId: input.residentId,
        visitorType: input.visitorType,
        purpose: input.purpose ?? null,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        maxEntries: input.maxEntries,
      },
      include: {
        visitor: true,
        flat: { include: { block: true } },
      },
    });
  });
}

export async function cancelGatePass(passId: string, residentId: string | null, reason?: string | null) {
  const pass = await prisma.gatePass.findUnique({
    where: { id: passId },
    select: { id: true, residentId: true, status: true, entriesUsed: true },
  });

  if (!pass) throw new NotFoundError('That gate pass no longer exists.');
  // A resident may only cancel their own pass; admins pass residentId = null.
  if (residentId && pass.residentId !== residentId) {
    throw new NotFoundError('That gate pass no longer exists.');
  }
  if (pass.status === 'CANCELLED') throw new ConflictError('This pass has already been cancelled.');
  if (pass.status === 'USED' || pass.entriesUsed > 0) {
    throw new ConflictError('This pass has already been used at the gate and cannot be cancelled.');
  }

  return prisma.gatePass.update({
    where: { id: passId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason ?? null },
  });
}

// ── Verification ──────────────────────────────────────────────────────────────

export type VerificationOutcome =
  | { ok: true; pass: VerifiedPass; warning?: string }
  | { ok: false; reason: string; detail: string; pass?: VerifiedPass };

export interface VerifiedPass {
  id: string;
  passCode: string;
  gateCode: string;
  status: GatePassStatus;
  visitorType: VisitorType;
  purpose: string | null;
  validFrom: Date;
  validUntil: Date;
  maxEntries: number;
  entriesUsed: number;
  visitor: {
    id: string;
    name: string;
    phone: string;
    vehicleNumber: string | null;
    company: string | null;
    photoUrl: string | null;
  };
  flat: { id: string; label: string };
  host: { name: string; phone: string };
}

const passSelect = {
  id: true,
  passCode: true,
  gateCode: true,
  status: true,
  visitorType: true,
  purpose: true,
  validFrom: true,
  validUntil: true,
  maxEntries: true,
  entriesUsed: true,
  visitor: {
    select: { id: true, name: true, phone: true, vehicleNumber: true, company: true, photoUrl: true },
  },
  flat: { select: { id: true, flatNumber: true, block: { select: { name: true } } } },
  resident: { select: { user: { select: { fullName: true, phone: true } } } },
} satisfies Prisma.GatePassSelect;

type RawPass = Prisma.GatePassGetPayload<{ select: typeof passSelect }>;

function shapePass(pass: RawPass): VerifiedPass {
  return {
    id: pass.id,
    passCode: pass.passCode,
    gateCode: pass.gateCode,
    status: pass.status,
    visitorType: pass.visitorType,
    purpose: pass.purpose,
    validFrom: pass.validFrom,
    validUntil: pass.validUntil,
    maxEntries: pass.maxEntries,
    entriesUsed: pass.entriesUsed,
    visitor: pass.visitor,
    flat: { id: pass.flat.id, label: `${pass.flat.block.name}-${pass.flat.flatNumber}` },
    host: { name: pass.resident.user.fullName, phone: pass.resident.user.phone },
  };
}

/**
 * Resolves a scanned QR payload, a printed pass code or a typed 6-digit gate
 * code to a pass, and decides whether entry may be granted.
 *
 * Every rejection path returns a plain-language reason: the guard console shows
 * it verbatim, which matters for the "non-technical security staff" usability
 * requirement.
 */
export async function verifyGateCode(rawCode: string): Promise<VerificationOutcome> {
  const code = parseScannedCode(rawCode);
  if (code.length < 4) {
    return { ok: false, reason: 'INVALID', detail: 'That code is too short to be a valid gate pass.' };
  }

  const normalised = code.toUpperCase();
  const pass = await prisma.gatePass.findFirst({
    where: {
      OR: [
        { qrToken: code },
        { passCode: normalised },
        // Numeric gate keys only — avoids scanning the whole table for text input.
        ...(/^\d{6}$/.test(code) ? [{ gateCode: code }] : []),
      ],
    },
    select: passSelect,
  });

  if (!pass) {
    return {
      ok: false,
      reason: 'NOT_FOUND',
      detail: 'No gate pass matches this code. Ask the visitor to confirm it, or log a walk-in entry.',
    };
  }

  const shaped = shapePass(pass);
  const now = new Date();

  if (pass.status === 'CANCELLED') {
    return { ok: false, reason: 'CANCELLED', detail: 'The resident cancelled this pass.', pass: shaped };
  }
  if (pass.status === 'REJECTED') {
    return { ok: false, reason: 'REJECTED', detail: 'Entry on this pass was previously refused.', pass: shaped };
  }
  if (pass.validFrom > now) {
    return {
      ok: false,
      reason: 'TOO_EARLY',
      detail: `This pass is not valid yet. It becomes active at ${formatDateTime(pass.validFrom)}.`,
      pass: shaped,
    };
  }
  if (pass.validUntil < now) {
    // Self-heal the status so expired passes stop appearing as active.
    if (pass.status === 'ACTIVE') {
      await prisma.gatePass.update({ where: { id: pass.id }, data: { status: 'EXPIRED' } });
      shaped.status = 'EXPIRED';
    }
    return {
      ok: false,
      reason: 'EXPIRED',
      detail: `This pass expired at ${formatDateTime(pass.validUntil)}. Ask the resident to issue a new one.`,
      pass: shaped,
    };
  }
  if (pass.entriesUsed >= pass.maxEntries) {
    return {
      ok: false,
      reason: 'ALREADY_USED',
      detail:
        pass.maxEntries === 1
          ? 'This single-entry pass has already been used.'
          : `All ${pass.maxEntries} permitted entries on this pass have been used.`,
      pass: shaped,
    };
  }

  // Duplicate-scan guard: is this visitor already recorded as inside?
  const openLog = await prisma.gateLog.findFirst({
    where: { visitorId: pass.visitor.id, status: 'INSIDE' },
    select: { id: true, entryAt: true },
  });

  if (openLog) {
    return {
      ok: false,
      reason: 'ALREADY_INSIDE',
      detail: `This visitor is already recorded inside (entered ${openLog.entryAt ? formatDateTime(openLog.entryAt) : 'earlier'}). Record an exit before scanning again.`,
      pass: shaped,
    };
  }

  return { ok: true, pass: shaped };
}

// ── Entry / exit ──────────────────────────────────────────────────────────────

export interface ApproveEntryInput {
  passId: string;
  guardId: string;
  gate: string;
  method: 'QR_SCAN' | 'GATE_CODE';
  vehicleNumber?: string | null;
  expectedExitAt?: Date | null;
  remarks?: string | null;
}

export async function approveEntry(input: ApproveEntryInput) {
  return prisma.$transaction(async (tx) => {
    const pass = await tx.gatePass.findUnique({
      where: { id: input.passId },
      select: {
        id: true,
        visitorId: true,
        flatId: true,
        status: true,
        maxEntries: true,
        entriesUsed: true,
        validUntil: true,
        visitor: { select: { vehicleNumber: true, name: true } },
      },
    });

    if (!pass) throw new NotFoundError('That gate pass no longer exists.');
    if (pass.validUntil < new Date()) throw new ConflictError('This pass has expired.');
    if (pass.entriesUsed >= pass.maxEntries) throw new ConflictError('This pass has no entries left.');

    // Re-check inside the transaction so two guards scanning at once cannot
    // both create an entry.
    const openLog = await tx.gateLog.findFirst({
      where: { visitorId: pass.visitorId, status: 'INSIDE' },
      select: { id: true },
    });
    if (openLog) throw new ConflictError('This visitor is already recorded inside the society.');

    const entriesUsed = pass.entriesUsed + 1;
    await tx.gatePass.update({
      where: { id: pass.id },
      data: {
        entriesUsed,
        status: entriesUsed >= pass.maxEntries ? 'USED' : 'ACTIVE',
      },
    });

    return tx.gateLog.create({
      data: {
        visitorId: pass.visitorId,
        flatId: pass.flatId,
        gatePassId: pass.id,
        guardId: input.guardId,
        gate: input.gate,
        verificationMethod: input.method,
        status: 'INSIDE',
        entryAt: new Date(),
        expectedExitAt: input.expectedExitAt ?? pass.validUntil,
        vehicleNumber: input.vehicleNumber ?? pass.visitor.vehicleNumber,
        remarks: input.remarks ?? null,
      },
      include: { visitor: true, flat: { include: { block: true } } },
    });
  });
}

export async function rejectEntry(input: {
  passId: string;
  guardId: string;
  gate: string;
  reason: string;
}) {
  const pass = await prisma.gatePass.findUnique({
    where: { id: input.passId },
    select: { id: true, visitorId: true, flatId: true },
  });
  if (!pass) throw new NotFoundError('That gate pass no longer exists.');

  return prisma.$transaction(async (tx) => {
    await tx.gatePass.update({ where: { id: pass.id }, data: { status: 'REJECTED' } });
    return tx.gateLog.create({
      data: {
        visitorId: pass.visitorId,
        flatId: pass.flatId,
        gatePassId: pass.id,
        guardId: input.guardId,
        gate: input.gate,
        verificationMethod: 'MANUAL',
        status: 'DENIED',
        denialReason: input.reason,
      },
      include: { visitor: true, flat: { include: { block: true } } },
    });
  });
}

export interface WalkInInput {
  guardId: string;
  flatId: string;
  name: string;
  phone: string;
  visitorType: VisitorType;
  vehicleNumber?: string | null;
  company?: string | null;
  idProofType?: string | null;
  idProofNumber?: string | null;
  gate: string;
  expectedExitAt?: Date | null;
  remarks?: string | null;
}

/** Walk-in visitor with no pre-approval (SRS §1.6, Security Personnel #1). */
export async function logWalkInVisitor(input: WalkInInput) {
  const flat = await prisma.flat.findFirst({
    where: { id: input.flatId, deletedAt: null },
    select: { id: true },
  });
  if (!flat) throw new NotFoundError('That flat could not be found.');

  return prisma.$transaction(async (tx) => {
    const visitor = await tx.visitor.create({
      data: {
        flatId: input.flatId,
        name: input.name,
        phone: input.phone,
        visitorType: input.visitorType,
        vehicleNumber: input.vehicleNumber ?? null,
        company: input.company ?? null,
        idProofType: input.idProofType ?? null,
        idProofNumber: input.idProofNumber ?? null,
      },
    });

    return tx.gateLog.create({
      data: {
        visitorId: visitor.id,
        flatId: input.flatId,
        guardId: input.guardId,
        gate: input.gate,
        verificationMethod: 'MANUAL',
        status: 'INSIDE',
        entryAt: new Date(),
        expectedExitAt: input.expectedExitAt ?? new Date(Date.now() + 4 * 3_600_000),
        vehicleNumber: input.vehicleNumber ?? null,
        remarks: input.remarks ?? null,
      },
      include: { visitor: true, flat: { include: { block: true } } },
    });
  });
}

export async function recordExit(gateLogId: string, guardId: string, remarks?: string | null) {
  const log = await prisma.gateLog.findUnique({
    where: { id: gateLogId },
    select: { id: true, status: true, exitAt: true },
  });

  if (!log) throw new NotFoundError('That gate entry no longer exists.');
  if (log.exitAt || log.status === 'EXITED') {
    throw new ConflictError('An exit has already been recorded for this visitor.');
  }
  if (log.status === 'DENIED') {
    throw new ConflictError('This visitor was refused entry, so there is no exit to record.');
  }

  return prisma.gateLog.update({
    where: { id: gateLogId },
    data: {
      status: 'EXITED',
      exitAt: new Date(),
      guardId,
      remarks: remarks ?? undefined,
    },
    include: { visitor: true, flat: { include: { block: true } } },
  });
}

// ── Housekeeping ──────────────────────────────────────────────────────────────

/**
 * Flags visitors who are still inside past their expected exit time
 * (SRS §1.6, Security Personnel #3 — "Overstay & Delivery Alerts").
 *
 * Called opportunistically when the guard dashboard loads, which keeps the
 * deployment free of a background job runner.
 */
export async function findOverstayingVisitors() {
  return prisma.gateLog.findMany({
    where: {
      status: 'INSIDE',
      entryAt: { not: null },
      expectedExitAt: { lt: new Date() },
    },
    orderBy: { expectedExitAt: 'asc' },
    include: {
      visitor: true,
      flat: { include: { block: true } },
    },
  });
}

/** Marks passes whose window has closed as EXPIRED. Cheap and idempotent. */
export async function expireStalePasses(): Promise<number> {
  const result = await prisma.gatePass.updateMany({
    where: { status: 'ACTIVE', validUntil: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return result.count;
}
