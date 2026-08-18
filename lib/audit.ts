import 'server-only';

import type { Prisma, Role } from '@prisma/client';

import prisma from '@/lib/prisma';
import { requestContext } from '@/lib/auth/session';

/**
 * Immutable audit trail (NFR "Audit Logging").
 *
 * Nothing in the application updates or deletes these rows — the admin console
 * exposes read-only views. Writes are best-effort: a logging failure must never
 * roll back the business operation that produced it.
 */

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGED: 'auth.password.changed',

  RESIDENT_CREATED: 'resident.created',
  RESIDENT_UPDATED: 'resident.updated',
  RESIDENT_OFFBOARDED: 'resident.offboarded',

  FLAT_CREATED: 'flat.created',
  FLAT_UPDATED: 'flat.updated',
  FLAT_DELETED: 'flat.deleted',

  STAFF_CREATED: 'staff.created',
  STAFF_UPDATED: 'staff.updated',

  VEHICLE_CREATED: 'vehicle.created',
  VEHICLE_DELETED: 'vehicle.deleted',
  FAMILY_MEMBER_CREATED: 'family_member.created',
  FAMILY_MEMBER_DELETED: 'family_member.deleted',

  BILL_GENERATED: 'bill.generated',
  BILL_UPDATED: 'bill.updated',
  BILL_CANCELLED: 'bill.cancelled',
  PENALTY_APPLIED: 'bill.penalty.applied',
  PAYMENT_SIMULATED: 'payment.simulated',

  COMPLAINT_CREATED: 'complaint.created',
  COMPLAINT_ASSIGNED: 'complaint.assigned',
  COMPLAINT_STATUS_CHANGED: 'complaint.status.changed',
  COMPLAINT_NOTE_ADDED: 'complaint.note.added',

  GATE_PASS_CREATED: 'gatepass.created',
  GATE_PASS_CANCELLED: 'gatepass.cancelled',
  GATE_VERIFICATION: 'gate.verification',
  GATE_ENTRY: 'gate.entry',
  GATE_EXIT: 'gate.exit',
  VISITOR_LOGGED: 'visitor.logged',

  BOOKING_CREATED: 'booking.created',
  BOOKING_CANCELLED: 'booking.cancelled',
  AMENITY_CREATED: 'amenity.created',
  AMENITY_UPDATED: 'amenity.updated',

  NOTICE_CREATED: 'notice.created',
  NOTICE_UPDATED: 'notice.updated',
  NOTICE_DELETED: 'notice.deleted',

  POLL_CREATED: 'poll.created',
  POLL_UPDATED: 'poll.updated',
  POLL_VOTED: 'poll.voted',

  ALERT_BROADCAST: 'alert.broadcast',
  ALERT_RESOLVED: 'alert.resolved',

  SETTINGS_UPDATED: 'settings.updated',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditInput {
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue;
  actor?: { id: string | null; name: string | null; role: Role | null } | null;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const { ipAddress, userAgent } = await requestContext().catch(() => ({
      ipAddress: null,
      userAgent: null,
    }));

    await prisma.auditLog.create({
      data: {
        userId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? null,
        actorRole: input.actor?.role ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        description: input.description,
        metadata: input.metadata,
        ipAddress,
        userAgent: userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write audit entry', error);
  }
}

/** Convenience wrapper for the common "current signed-in user did X" case. */
export function auditActor(user: {
  id: string;
  fullName: string;
  role: Role;
}): NonNullable<AuditInput['actor']> {
  return { id: user.id, name: user.fullName, role: user.role };
}
