'use server';

import { revalidatePath } from 'next/cache';

import { type ActionState, failure, runAction, success } from '@/lib/action-result';
import { AUDIT_ACTIONS, auditActor, recordAudit } from '@/lib/audit';
import { requireResident, requireRole } from '@/lib/auth/session';
import { ForbiddenError } from '@/lib/errors';
import { notify, notifyFlat, notifyRoles } from '@/lib/notifications';
import prisma from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  approveEntrySchema,
  cancelGatePassSchema,
  gatePassSchema,
  recordExitSchema,
  rejectEntrySchema,
  verifyPassSchema,
  walkInVisitorSchema,
} from '@/lib/validations/visitor';
import {
  approveEntry,
  cancelGatePass,
  createGatePass,
  logWalkInVisitor,
  recordExit,
  rejectEntry,
  verifyGateCode,
  type VerifiedPass,
} from '@/services/gate-service';
import { humanise } from '@/lib/utils';

/**
 * Visitor pre-approval (residents) and gate verification (guards).
 *
 * Every action re-authenticates and re-authorises server-side; the client never
 * supplies the acting user's identity.
 */

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

// ── Resident ──────────────────────────────────────────────────────────────────

export async function createGatePassAction(
  _prev: ActionState<{ passId: string }>,
  formData: FormData,
): Promise<ActionState<{ passId: string }>> {
  return runAction(async () => {
    const user = await requireResident();
    enforceRateLimit(`gatepass:create:${user.id}`, 20, 3600);

    const input = gatePassSchema.parse({
      visitorName: formValue(formData, 'visitorName'),
      visitorPhone: formValue(formData, 'visitorPhone'),
      visitorType: formValue(formData, 'visitorType'),
      vehicleNumber: formValue(formData, 'vehicleNumber') ?? '',
      company: formValue(formData, 'company'),
      purpose: formValue(formData, 'purpose'),
      validFrom: formValue(formData, 'validFrom'),
      validUntil: formValue(formData, 'validUntil'),
      maxEntries: formValue(formData, 'maxEntries') ?? '1',
    });

    const pass = await createGatePass({
      residentId: user.residentId,
      flatId: user.flatId,
      visitorName: input.visitorName,
      visitorPhone: input.visitorPhone,
      visitorType: input.visitorType,
      vehicleNumber: input.vehicleNumber,
      company: input.company,
      purpose: input.purpose,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      maxEntries: input.maxEntries,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.GATE_PASS_CREATED,
      entityType: 'GatePass',
      entityId: pass.id,
      description: `Created gate pass ${pass.passCode} for ${input.visitorName} (${humanise(input.visitorType)}) visiting ${user.flatLabel}.`,
      metadata: { passCode: pass.passCode, validUntil: input.validUntil.toISOString() },
      actor: auditActor(user),
    });

    await notify({
      userId: user.id,
      type: 'GATE_PASS_CREATED',
      title: 'Visitor pass created',
      body: `${input.visitorName} can enter using gate code ${pass.gateCode} until ${input.validUntil.toLocaleString('en-PK')}.`,
      link: `/resident/visitors/${pass.id}`,
      entityType: 'GatePass',
      entityId: pass.id,
    });

    // Guards on duty should see the pass under "expected today".
    await notifyRoles(['GUARD'], {
      type: 'GATE_PASS_CREATED',
      title: 'New visitor pre-approved',
      body: `${input.visitorName} is expected at flat ${user.flatLabel}. Gate code ${pass.gateCode}.`,
      link: '/guard/expected',
      entityType: 'GatePass',
      entityId: pass.id,
    });

    revalidatePath('/resident/visitors');
    revalidatePath('/resident');
    revalidatePath('/guard');

    return success('Gate pass created. Share the QR code or gate code with your visitor.', {
      passId: pass.id,
    });
  });
}

export async function cancelGatePassAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('RESIDENT', 'ADMIN');
    const input = cancelGatePassSchema.parse({
      passId: formValue(formData, 'passId'),
      reason: formValue(formData, 'reason'),
    });

    const pass = await cancelGatePass(
      input.passId,
      user.role === 'RESIDENT' ? user.residentId : null,
      input.reason,
    );

    await recordAudit({
      action: AUDIT_ACTIONS.GATE_PASS_CANCELLED,
      entityType: 'GatePass',
      entityId: pass.id,
      description: `Cancelled gate pass ${pass.passCode}.`,
      metadata: { reason: input.reason },
      actor: auditActor(user),
    });

    revalidatePath('/resident/visitors');
    revalidatePath('/admin/visitors');
    revalidatePath('/guard/expected');

    return success('Gate pass cancelled.');
  });
}

// ── Guard ─────────────────────────────────────────────────────────────────────

export interface VerificationView {
  outcome: 'GRANTED' | 'DENIED';
  reason?: string;
  detail?: string;
  pass?: VerifiedPass;
}

/**
 * Step 1 of gate clearance: resolve a scanned/typed code and report whether
 * entry may be granted. This never mutates the gate log — the guard confirms in
 * step 2 (`approveEntryAction`).
 */
export async function verifyPassAction(
  _prev: ActionState<VerificationView>,
  formData: FormData,
): Promise<ActionState<VerificationView>> {
  return runAction(async () => {
    const user = await requireRole('GUARD', 'ADMIN');
    // Generous, but enough to blunt an automated code-guessing attempt.
    enforceRateLimit(`verify:${user.id}`, 120, 60);

    const input = verifyPassSchema.parse({
      code: formValue(formData, 'code'),
      method: formValue(formData, 'method') ?? 'GATE_CODE',
    });

    const result = await verifyGateCode(input.code);

    await recordAudit({
      action: AUDIT_ACTIONS.GATE_VERIFICATION,
      entityType: 'GatePass',
      entityId: result.ok ? result.pass.id : (result.pass?.id ?? null),
      description: result.ok
        ? `Verified gate pass ${result.pass.passCode} for ${result.pass.visitor.name} — clearance granted.`
        : `Gate pass verification refused (${result.reason}).`,
      metadata: { method: input.method, outcome: result.ok ? 'GRANTED' : result.reason },
      actor: auditActor(user),
    });

    if (!result.ok) {
      const denied: VerificationView = {
        outcome: 'DENIED',
        reason: result.reason,
        detail: result.detail,
        pass: result.pass,
      };
      return success('Verification complete.', denied);
    }

    const granted: VerificationView = { outcome: 'GRANTED', pass: result.pass };
    return success('Pass verified.', granted);
  });
}

export async function approveEntryAction(
  _prev: ActionState<{ gateLogId: string }>,
  formData: FormData,
): Promise<ActionState<{ gateLogId: string }>> {
  return runAction(async () => {
    const user = await requireRole('GUARD', 'ADMIN');

    const input = approveEntrySchema.parse({
      passId: formValue(formData, 'passId'),
      gate: formValue(formData, 'gate') || 'Main Gate',
      vehicleNumber: formValue(formData, 'vehicleNumber') ?? '',
      expectedExitAt: formValue(formData, 'expectedExitAt') ?? '',
      remarks: formValue(formData, 'remarks'),
    });

    const method = formValue(formData, 'method') === 'QR_SCAN' ? 'QR_SCAN' : 'GATE_CODE';

    const log = await approveEntry({
      passId: input.passId,
      guardId: user.id,
      gate: input.gate,
      method,
      vehicleNumber: input.vehicleNumber,
      expectedExitAt: input.expectedExitAt,
      remarks: input.remarks,
    });

    const flatLabel = `${log.flat.block.name}-${log.flat.flatNumber}`;

    await recordAudit({
      action: AUDIT_ACTIONS.GATE_ENTRY,
      entityType: 'GateLog',
      entityId: log.id,
      description: `Approved entry for ${log.visitor.name} to flat ${flatLabel} at ${input.gate}.`,
      metadata: { gate: input.gate, method },
      actor: auditActor(user),
    });

    await notifyFlat(log.flatId, {
      type: 'VISITOR_ARRIVED',
      title: 'Your visitor has arrived',
      body: `${log.visitor.name} was cleared at the ${input.gate} and is on the way up.`,
      link: '/resident/visitors',
      entityType: 'GateLog',
      entityId: log.id,
    });

    revalidatePath('/guard');
    revalidatePath('/guard/logs');
    revalidatePath('/guard/expected');

    return success(`${log.visitor.name} cleared for entry to flat ${flatLabel}.`, {
      gateLogId: log.id,
    });
  });
}

export async function rejectEntryAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('GUARD', 'ADMIN');

    const input = rejectEntrySchema.parse({
      passId: formValue(formData, 'passId'),
      gate: formValue(formData, 'gate') || 'Main Gate',
      reason: formValue(formData, 'reason'),
    });

    const log = await rejectEntry({
      passId: input.passId,
      guardId: user.id,
      gate: input.gate,
      reason: input.reason,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.GATE_VERIFICATION,
      entityType: 'GateLog',
      entityId: log.id,
      description: `Refused entry for ${log.visitor.name} at ${input.gate}: ${input.reason}`,
      actor: auditActor(user),
    });

    await notifyFlat(log.flatId, {
      type: 'VISITOR_DENIED',
      title: 'Visitor entry refused',
      body: `${log.visitor.name} was refused entry at the ${input.gate}. Reason: ${input.reason}`,
      link: '/resident/visitors',
      isUrgent: true,
    });

    revalidatePath('/guard');
    revalidatePath('/guard/logs');

    return success('Entry refused and recorded in the gate log.');
  });
}

export async function logWalkInAction(
  _prev: ActionState<{ gateLogId: string }>,
  formData: FormData,
): Promise<ActionState<{ gateLogId: string }>> {
  return runAction(async () => {
    const user = await requireRole('GUARD', 'ADMIN');
    enforceRateLimit(`walkin:${user.id}`, 60, 300);

    const input = walkInVisitorSchema.parse({
      name: formValue(formData, 'name'),
      phone: formValue(formData, 'phone'),
      visitorType: formValue(formData, 'visitorType'),
      flatId: formValue(formData, 'flatId'),
      vehicleNumber: formValue(formData, 'vehicleNumber') ?? '',
      company: formValue(formData, 'company'),
      idProofType: formValue(formData, 'idProofType'),
      idProofNumber: formValue(formData, 'idProofNumber'),
      gate: formValue(formData, 'gate') || 'Main Gate',
      expectedExitAt: formValue(formData, 'expectedExitAt') ?? '',
      remarks: formValue(formData, 'remarks'),
    });

    const log = await logWalkInVisitor({
      guardId: user.id,
      flatId: input.flatId,
      name: input.name,
      phone: input.phone,
      visitorType: input.visitorType,
      vehicleNumber: input.vehicleNumber,
      company: input.company,
      idProofType: input.idProofType,
      idProofNumber: input.idProofNumber,
      gate: input.gate,
      expectedExitAt: input.expectedExitAt,
      remarks: input.remarks,
    });

    const flatLabel = `${log.flat.block.name}-${log.flat.flatNumber}`;

    await recordAudit({
      action: AUDIT_ACTIONS.VISITOR_LOGGED,
      entityType: 'GateLog',
      entityId: log.id,
      description: `Logged walk-in visitor ${log.visitor.name} (${humanise(input.visitorType)}) for flat ${flatLabel} at ${input.gate}.`,
      actor: auditActor(user),
    });

    await notifyFlat(log.flatId, {
      type: 'VISITOR_ARRIVED',
      title: 'Visitor at the gate',
      body: `${log.visitor.name}${input.company ? ` (${input.company})` : ''} has been logged in at the ${input.gate} for your flat.`,
      link: '/resident/visitors',
      entityType: 'GateLog',
      entityId: log.id,
    });

    revalidatePath('/guard');
    revalidatePath('/guard/logs');

    return success(`${log.visitor.name} logged in for flat ${flatLabel}.`, { gateLogId: log.id });
  });
}

export async function recordExitAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('GUARD', 'ADMIN');

    const input = recordExitSchema.parse({
      gateLogId: formValue(formData, 'gateLogId'),
      remarks: formValue(formData, 'remarks'),
    });

    const log = await recordExit(input.gateLogId, user.id, input.remarks);
    const flatLabel = `${log.flat.block.name}-${log.flat.flatNumber}`;

    await recordAudit({
      action: AUDIT_ACTIONS.GATE_EXIT,
      entityType: 'GateLog',
      entityId: log.id,
      description: `Recorded exit for ${log.visitor.name} (flat ${flatLabel}).`,
      actor: auditActor(user),
    });

    revalidatePath('/guard');
    revalidatePath('/guard/logs');

    return success(`Exit recorded for ${log.visitor.name}.`);
  });
}

/** Raises an overstay notification for the host flat and the guards on duty. */
export async function flagOverstayAction(gateLogId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('GUARD', 'ADMIN');

    const log = await prisma.gateLog.findUnique({
      where: { id: gateLogId },
      include: { visitor: true, flat: { include: { block: true } } },
    });
    if (!log || log.status !== 'INSIDE') {
      return failure('That visitor is no longer recorded inside the society.');
    }
    if (log.overstayNotifiedAt) {
      return failure('An overstay alert has already been raised for this visitor.');
    }

    await prisma.gateLog.update({
      where: { id: log.id },
      data: { status: 'OVERSTAY', overstayNotifiedAt: new Date() },
    });

    const flatLabel = `${log.flat.block.name}-${log.flat.flatNumber}`;

    await notifyFlat(log.flatId, {
      type: 'OVERSTAY',
      title: 'Visitor overstay',
      body: `${log.visitor.name} is still inside the society past the expected exit time. Please confirm with the gate.`,
      link: '/resident/visitors',
      isUrgent: true,
    });

    await notifyRoles(['ADMIN'], {
      type: 'OVERSTAY',
      title: 'Visitor overstay flagged',
      body: `${log.visitor.name} (flat ${flatLabel}) has exceeded the expected exit time.`,
      link: '/admin/security',
      isUrgent: true,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.GATE_ENTRY,
      entityType: 'GateLog',
      entityId: log.id,
      description: `Flagged overstay for ${log.visitor.name} (flat ${flatLabel}).`,
      actor: auditActor(user),
    });

    revalidatePath('/guard');
    revalidatePath('/guard/logs');

    return success('Overstay alert raised.');
  });
}

/** Flat picker used by the guard's walk-in form. */
export async function searchFlatsAction(term: string) {
  const user = await requireRole('GUARD', 'ADMIN');
  if (!user) throw new ForbiddenError();

  const query = term.trim();
  const flats = await prisma.flat.findMany({
    where: {
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { flatNumber: { contains: query, mode: 'insensitive' } },
              { block: { name: { contains: query, mode: 'insensitive' } } },
              {
                residents: {
                  some: {
                    deletedAt: null,
                    user: { fullName: { contains: query, mode: 'insensitive' } },
                  },
                },
              },
            ],
          }
        : {}),
    },
    take: 20,
    orderBy: [{ block: { name: 'asc' } }, { flatNumber: 'asc' }],
    select: {
      id: true,
      flatNumber: true,
      block: { select: { name: true } },
      residents: {
        where: { deletedAt: null, isPrimary: true },
        select: { user: { select: { fullName: true, phone: true } } },
        take: 1,
      },
    },
  });

  return flats.map((flat) => ({
    id: flat.id,
    label: `${flat.block.name}-${flat.flatNumber}`,
    resident: flat.residents[0]?.user.fullName ?? 'Vacant',
    phone: flat.residents[0]?.user.phone ?? null,
  }));
}
