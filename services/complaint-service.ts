import 'server-only';

import type {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  Prisma,
  StaffDepartment,
} from '@prisma/client';

import prisma from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { generateTicketNumber } from '@/lib/codes';
import { SLA_HOURS } from '@/lib/validations/complaint';

/**
 * Helpdesk / complaint management.
 *
 * SRS §1.6 — residents raise categorised tickets with photo uploads and track
 * status; administrators route them to maintenance personnel and monitor
 * resolution SLAs.
 */

/** Which department a category is routed to by default. */
export const CATEGORY_DEPARTMENT: Record<ComplaintCategory, StaffDepartment> = {
  PLUMBING: 'PLUMBING',
  WATER: 'PLUMBING',
  ELECTRICAL: 'ELECTRICAL',
  ELEVATOR: 'ELEVATOR',
  CLEANING: 'HOUSEKEEPING',
  SECURITY: 'SECURITY',
  CARPENTRY: 'GENERAL',
  PEST_CONTROL: 'GENERAL',
  OTHER: 'GENERAL',
};

export const complaintDetailInclude = {
  resident: {
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true } },
      flat: { include: { block: true } },
    },
  },
  flat: { include: { block: true } },
  assignedStaff: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
  attachments: { orderBy: { createdAt: 'asc' } },
  updates: {
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, fullName: true, role: true } } },
  },
} satisfies Prisma.ComplaintInclude;

export type ComplaintDetail = Prisma.ComplaintGetPayload<{ include: typeof complaintDetailInclude }>;

export function slaDueDate(priority: ComplaintPriority, from = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 3_600_000);
}

/** SLA state used by the badge on every ticket row. */
export function slaState(complaint: {
  status: ComplaintStatus;
  slaDueAt: Date;
  resolvedAt: Date | null;
}): { label: string; tone: 'success' | 'warning' | 'destructive' | 'muted'; overdue: boolean } {
  const settled = complaint.status === 'RESOLVED' || complaint.status === 'CLOSED';

  if (settled) {
    const finishedAt = complaint.resolvedAt ?? complaint.slaDueAt;
    const withinSla = finishedAt <= complaint.slaDueAt;
    return {
      label: withinSla ? 'Met SLA' : 'Missed SLA',
      tone: withinSla ? 'success' : 'destructive',
      overdue: !withinSla,
    };
  }

  const msLeft = complaint.slaDueAt.getTime() - Date.now();
  if (msLeft < 0) return { label: 'SLA breached', tone: 'destructive', overdue: true };
  if (msLeft < 4 * 3_600_000) return { label: 'Due soon', tone: 'warning', overdue: false };
  return { label: 'On track', tone: 'muted', overdue: false };
}

// ── Create ────────────────────────────────────────────────────────────────────

export interface CreateComplaintInput {
  residentId: string;
  flatId: string;
  userId: string;
  title: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  description: string;
  location?: string | null;
}

export async function createComplaint(input: CreateComplaintInput) {
  const now = new Date();

  return prisma.complaint.create({
    data: {
      ticketNumber: generateTicketNumber(now.getFullYear()),
      residentId: input.residentId,
      flatId: input.flatId,
      title: input.title,
      category: input.category,
      priority: input.priority,
      description: input.description,
      location: input.location ?? null,
      status: 'PENDING',
      slaDueAt: slaDueDate(input.priority, now),
      updates: {
        create: {
          authorId: input.userId,
          toStatus: 'PENDING',
          note: 'Ticket raised through the resident helpdesk.',
        },
      },
    },
    include: { flat: { include: { block: true } } },
  });
}

export async function attachComplaintFile(input: {
  complaintId: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}) {
  return prisma.complaintAttachment.create({ data: input });
}

// ── Assignment & status ───────────────────────────────────────────────────────

export async function assignComplaint(input: {
  complaintId: string;
  staffId: string;
  actorId: string;
  priority?: ComplaintPriority;
  note?: string | null;
}) {
  const [complaint, staff] = await Promise.all([
    prisma.complaint.findFirst({
      where: { id: input.complaintId, deletedAt: null },
      select: { id: true, status: true, priority: true, createdAt: true, assignedStaffId: true },
    }),
    prisma.staffProfile.findFirst({
      where: { id: input.staffId, deletedAt: null },
      include: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  if (!complaint) throw new NotFoundError('That ticket no longer exists.');
  if (!staff) throw new NotFoundError('That staff member could not be found.');
  if (complaint.status === 'CLOSED') throw new ConflictError('This ticket is closed and cannot be reassigned.');

  const priority = input.priority ?? complaint.priority;
  const now = new Date();

  const updated = await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      assignedStaffId: staff.id,
      assignedAt: now,
      priority,
      // Re-base the SLA clock when the priority is changed at assignment time.
      slaDueAt: input.priority ? slaDueDate(priority, complaint.createdAt) : undefined,
      firstResponseAt: { set: now },
      status: complaint.status === 'PENDING' ? 'IN_PROGRESS' : complaint.status,
      updates: {
        create: {
          authorId: input.actorId,
          fromStatus: complaint.status,
          toStatus: complaint.status === 'PENDING' ? 'IN_PROGRESS' : complaint.status,
          note:
            input.note?.trim() ||
            `Assigned to ${staff.user.fullName} (${staff.designation}). Target resolution within ${SLA_HOURS[priority]} hours.`,
        },
      },
    },
    include: {
      resident: { include: { user: { select: { id: true } } } },
      flat: { include: { block: true } },
    },
  });

  return { complaint: updated, staffUserId: staff.user.id, staffName: staff.user.fullName };
}

const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  PENDING: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['IN_PROGRESS', 'RESOLVED', 'PENDING', 'CLOSED'],
  // A resolved ticket can be reopened if the fix did not hold.
  RESOLVED: ['RESOLVED', 'CLOSED', 'IN_PROGRESS'],
  CLOSED: ['CLOSED'],
};

export async function changeComplaintStatus(input: {
  complaintId: string;
  status: ComplaintStatus;
  actorId: string;
  note: string;
  isInternal?: boolean;
  resolutionNotes?: string | null;
  /** When set, the caller must be the assigned technician. */
  restrictToStaffId?: string | null;
}) {
  const complaint = await prisma.complaint.findFirst({
    where: { id: input.complaintId, deletedAt: null },
    select: {
      id: true,
      status: true,
      assignedStaffId: true,
      resolvedAt: true,
      residentId: true,
      resident: { select: { userId: true } },
      ticketNumber: true,
      title: true,
    },
  });

  if (!complaint) throw new NotFoundError('That ticket no longer exists.');

  if (input.restrictToStaffId && complaint.assignedStaffId !== input.restrictToStaffId) {
    throw new NotFoundError('That ticket is not assigned to you.');
  }

  if (!ALLOWED_TRANSITIONS[complaint.status].includes(input.status)) {
    throw new ConflictError(
      `A ticket that is ${complaint.status.toLowerCase().replace('_', ' ')} cannot be moved to ${input.status
        .toLowerCase()
        .replace('_', ' ')}.`,
    );
  }

  const now = new Date();
  const becomingResolved = input.status === 'RESOLVED' && complaint.status !== 'RESOLVED';
  const becomingClosed = input.status === 'CLOSED';
  const reopening = complaint.status === 'RESOLVED' && input.status === 'IN_PROGRESS';

  const updated = await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      status: input.status,
      resolvedAt: becomingResolved ? now : reopening ? null : undefined,
      closedAt: becomingClosed ? now : undefined,
      resolutionNotes: input.resolutionNotes ?? (becomingResolved ? input.note : undefined),
      firstResponseAt: complaint.status === 'PENDING' ? now : undefined,
      updates: {
        create: {
          authorId: input.actorId,
          fromStatus: complaint.status,
          toStatus: input.status,
          note: input.note,
          isInternal: input.isInternal ?? false,
        },
      },
    },
    include: { flat: { include: { block: true } } },
  });

  return { complaint: updated, residentUserId: complaint.resident.userId, previousStatus: complaint.status };
}

export async function addComplaintNote(input: {
  complaintId: string;
  actorId: string;
  note: string;
  isInternal: boolean;
  restrictToStaffId?: string | null;
}) {
  const complaint = await prisma.complaint.findFirst({
    where: { id: input.complaintId, deletedAt: null },
    select: { id: true, assignedStaffId: true, resident: { select: { userId: true } }, ticketNumber: true },
  });
  if (!complaint) throw new NotFoundError('That ticket no longer exists.');
  if (input.restrictToStaffId && complaint.assignedStaffId !== input.restrictToStaffId) {
    throw new NotFoundError('That ticket is not assigned to you.');
  }

  await prisma.complaintUpdate.create({
    data: {
      complaintId: complaint.id,
      authorId: input.actorId,
      note: input.note,
      isInternal: input.isInternal,
    },
  });

  return { residentUserId: complaint.resident.userId, ticketNumber: complaint.ticketNumber };
}

// ── Reads & statistics ────────────────────────────────────────────────────────

export async function getComplaintStats(where: Prisma.ComplaintWhereInput = {}) {
  const scoped: Prisma.ComplaintWhereInput = { deletedAt: null, ...where };

  const [byStatus, byCategory, breached, avgResolution] = await Promise.all([
    prisma.complaint.groupBy({ by: ['status'], where: scoped, _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ['category'], where: scoped, _count: { _all: true } }),
    prisma.complaint.count({
      where: { ...scoped, status: { in: ['PENDING', 'IN_PROGRESS'] }, slaDueAt: { lt: new Date() } },
    }),
    prisma.complaint.findMany({
      where: { ...scoped, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 200,
      orderBy: { resolvedAt: 'desc' },
    }),
  ]);

  const counts = { PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 } as Record<ComplaintStatus, number>;
  for (const row of byStatus) counts[row.status] = row._count._all;

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const resolutionHours =
    avgResolution.length > 0
      ? avgResolution.reduce(
          (sum, row) => sum + (row.resolvedAt!.getTime() - row.createdAt.getTime()) / 3_600_000,
          0,
        ) / avgResolution.length
      : 0;

  return {
    total,
    counts,
    open: counts.PENDING + counts.IN_PROGRESS,
    slaBreached: breached,
    averageResolutionHours: Number(resolutionHours.toFixed(1)),
    byCategory: byCategory
      .map((row) => ({ category: row.category, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Technicians eligible for a category, best match first. */
export async function getAssignableStaff(category?: ComplaintCategory) {
  const preferred = category ? CATEGORY_DEPARTMENT[category] : null;

  const staff = await prisma.staffProfile.findMany({
    where: {
      deletedAt: null,
      user: { role: 'MAINTENANCE_STAFF', status: 'ACTIVE', deletedAt: null },
    },
    include: {
      user: { select: { id: true, fullName: true, phone: true } },
      _count: {
        select: { assignedComplaints: { where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } } },
      },
    },
    orderBy: { user: { fullName: 'asc' } },
  });

  return staff
    .map((member) => ({
      id: member.id,
      userId: member.user.id,
      name: member.user.fullName,
      phone: member.user.phone,
      department: member.department,
      designation: member.designation,
      openTickets: member._count.assignedComplaints,
      recommended: preferred !== null && member.department === preferred,
    }))
    .sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      return a.openTickets - b.openTickets;
    });
}
