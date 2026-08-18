import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError } from '@/lib/errors';
import {
  addComplaintNote,
  assignComplaint,
  changeComplaintStatus,
  createComplaint,
  getAssignableStaff,
  getComplaintStats,
} from '@/services/complaint-service';
import { SLA_HOURS } from '@/lib/validations/complaint';
import { prisma, resetDatabase, seedBaseline, type Baseline } from '../setup/fixtures';

let baseline: Baseline;

async function makeTicket(overrides: Partial<Parameters<typeof createComplaint>[0]> = {}) {
  return createComplaint({
    residentId: baseline.resident.residentId,
    flatId: baseline.flatA.id,
    userId: baseline.resident.userId,
    title: 'Kitchen sink drain is blocked',
    category: 'PLUMBING',
    priority: 'MEDIUM',
    description: 'Water drains very slowly and there is a foul smell from the pipe.',
    location: 'Kitchen',
    ...overrides,
  });
}

beforeAll(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

beforeEach(async () => {
  await prisma.complaintUpdate.deleteMany();
  await prisma.complaintAttachment.deleteMany();
  await prisma.complaint.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('raising a ticket', () => {
  it('creates it as PENDING with a ticket number and an SLA target', async () => {
    const ticket = await makeTicket();

    expect(ticket.status).toBe('PENDING');
    expect(ticket.ticketNumber).toMatch(/^TKT-\d{4}-[0-9A-Z]{6}$/);
    expect(ticket.assignedStaffId).toBeNull();

    const hoursToDue = (ticket.slaDueAt.getTime() - ticket.createdAt.getTime()) / 3_600_000;
    expect(Math.round(hoursToDue)).toBe(SLA_HOURS.MEDIUM);
  });

  it('sets a tighter SLA for a critical ticket', async () => {
    const ticket = await makeTicket({ priority: 'CRITICAL', title: 'Lift stuck between floors' });
    const hoursToDue = (ticket.slaDueAt.getTime() - ticket.createdAt.getTime()) / 3_600_000;
    expect(Math.round(hoursToDue)).toBe(SLA_HOURS.CRITICAL);
  });

  it('records the opening entry in the ticket history', async () => {
    const ticket = await makeTicket();
    const updates = await prisma.complaintUpdate.findMany({ where: { complaintId: ticket.id } });

    expect(updates).toHaveLength(1);
    expect(updates[0].toStatus).toBe('PENDING');
    expect(updates[0].authorId).toBe(baseline.resident.userId);
  });
});

describe('assignment', () => {
  it('assigns a technician, moves the ticket to IN_PROGRESS and logs it', async () => {
    const ticket = await makeTicket();
    const result = await assignComplaint({
      complaintId: ticket.id,
      staffId: baseline.technician.staffId,
      actorId: baseline.admin.id,
    });

    expect(result.complaint.status).toBe('IN_PROGRESS');
    expect(result.complaint.assignedStaffId).toBe(baseline.technician.staffId);
    expect(result.complaint.assignedAt).not.toBeNull();
    expect(result.complaint.firstResponseAt).not.toBeNull();
    expect(result.staffName).toBe('Test Technician');

    const updates = await prisma.complaintUpdate.findMany({
      where: { complaintId: ticket.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(updates).toHaveLength(2);
    expect(updates[1].toStatus).toBe('IN_PROGRESS');
  });

  it('re-bases the SLA when the priority is raised at assignment time', async () => {
    const ticket = await makeTicket();
    const result = await assignComplaint({
      complaintId: ticket.id,
      staffId: baseline.technician.staffId,
      actorId: baseline.admin.id,
      priority: 'CRITICAL',
    });

    expect(result.complaint.priority).toBe('CRITICAL');
    const hours =
      (result.complaint.slaDueAt.getTime() - result.complaint.createdAt.getTime()) / 3_600_000;
    expect(Math.round(hours)).toBe(SLA_HOURS.CRITICAL);
  });

  it('refuses to assign a closed ticket', async () => {
    const ticket = await makeTicket();
    await prisma.complaint.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });

    await expect(
      assignComplaint({
        complaintId: ticket.id,
        staffId: baseline.technician.staffId,
        actorId: baseline.admin.id,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('recommends the technician whose department matches the category', async () => {
    const staff = await getAssignableStaff('PLUMBING');
    expect(staff[0].department).toBe('PLUMBING');
    expect(staff[0].recommended).toBe(true);
  });
});

describe('status transitions', () => {
  it('walks a ticket from pending to resolved and stamps resolvedAt', async () => {
    const ticket = await makeTicket();
    await assignComplaint({
      complaintId: ticket.id,
      staffId: baseline.technician.staffId,
      actorId: baseline.admin.id,
    });

    const result = await changeComplaintStatus({
      complaintId: ticket.id,
      status: 'RESOLVED',
      actorId: baseline.technician.userId,
      note: 'Cleared the blockage and tested the drain.',
      restrictToStaffId: baseline.technician.staffId,
    });

    expect(result.complaint.status).toBe('RESOLVED');
    expect(result.complaint.resolvedAt).not.toBeNull();
    expect(result.complaint.resolutionNotes).toContain('Cleared the blockage');
  });

  it('stops a technician from touching a ticket assigned to someone else', async () => {
    const ticket = await makeTicket();

    await expect(
      changeComplaintStatus({
        complaintId: ticket.id,
        status: 'RESOLVED',
        actorId: baseline.technician.userId,
        note: 'Trying to close someone else’s ticket.',
        restrictToStaffId: baseline.technician.staffId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('refuses an invalid transition out of CLOSED', async () => {
    const ticket = await makeTicket();
    await prisma.complaint.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });

    await expect(
      changeComplaintStatus({
        complaintId: ticket.id,
        status: 'IN_PROGRESS',
        actorId: baseline.admin.id,
        note: 'Reopening a closed ticket.',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('clears resolvedAt when a resolved ticket is reopened', async () => {
    const ticket = await makeTicket();
    await changeComplaintStatus({
      complaintId: ticket.id,
      status: 'RESOLVED',
      actorId: baseline.admin.id,
      note: 'Marked as fixed.',
    });
    const reopened = await changeComplaintStatus({
      complaintId: ticket.id,
      status: 'IN_PROGRESS',
      actorId: baseline.admin.id,
      note: 'Resident reports the problem is back.',
    });

    expect(reopened.complaint.status).toBe('IN_PROGRESS');
    expect(reopened.complaint.resolvedAt).toBeNull();
  });

  it('stamps closedAt when an administrator closes a ticket', async () => {
    const ticket = await makeTicket();
    await changeComplaintStatus({
      complaintId: ticket.id,
      status: 'RESOLVED',
      actorId: baseline.admin.id,
      note: 'Fixed.',
    });
    const closed = await changeComplaintStatus({
      complaintId: ticket.id,
      status: 'CLOSED',
      actorId: baseline.admin.id,
      note: 'Resident confirmed. Closing.',
    });

    expect(closed.complaint.closedAt).not.toBeNull();
  });

  it('keeps a full audit trail of every transition', async () => {
    const ticket = await makeTicket();
    await assignComplaint({
      complaintId: ticket.id,
      staffId: baseline.technician.staffId,
      actorId: baseline.admin.id,
    });
    await changeComplaintStatus({
      complaintId: ticket.id,
      status: 'RESOLVED',
      actorId: baseline.technician.userId,
      note: 'Work completed.',
    });
    await changeComplaintStatus({
      complaintId: ticket.id,
      status: 'CLOSED',
      actorId: baseline.admin.id,
      note: 'Closed.',
    });

    const updates = await prisma.complaintUpdate.findMany({
      where: { complaintId: ticket.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(updates).toHaveLength(4);
    expect(updates.map((update) => update.toStatus)).toEqual([
      'PENDING',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
    ]);
  });
});

describe('notes', () => {
  it('adds a public note visible to the resident', async () => {
    const ticket = await makeTicket();
    const result = await addComplaintNote({
      complaintId: ticket.id,
      actorId: baseline.admin.id,
      note: 'A technician will visit tomorrow morning.',
      isInternal: false,
    });

    expect(result.residentUserId).toBe(baseline.resident.userId);

    const note = await prisma.complaintUpdate.findFirstOrThrow({
      where: { complaintId: ticket.id, note: { contains: 'tomorrow morning' } },
    });
    expect(note.isInternal).toBe(false);
  });

  it('marks an internal note so it can be filtered from the resident view', async () => {
    const ticket = await makeTicket();
    await addComplaintNote({
      complaintId: ticket.id,
      actorId: baseline.admin.id,
      note: 'Spare part is out of stock; do not tell the resident yet.',
      isInternal: true,
    });

    const note = await prisma.complaintUpdate.findFirstOrThrow({
      where: { complaintId: ticket.id, isInternal: true },
    });
    expect(note.note).toContain('out of stock');
  });
});

describe('statistics', () => {
  it('counts tickets by status and flags SLA breaches', async () => {
    const open = await makeTicket();
    await prisma.complaint.update({
      where: { id: open.id },
      data: { slaDueAt: new Date(Date.now() - 3_600_000) },
    });

    const resolved = await makeTicket({ title: 'Corridor light not working' });
    await changeComplaintStatus({
      complaintId: resolved.id,
      status: 'RESOLVED',
      actorId: baseline.admin.id,
      note: 'Replaced the tube light.',
    });

    const stats = await getComplaintStats();
    expect(stats.total).toBe(2);
    expect(stats.counts.PENDING).toBe(1);
    expect(stats.counts.RESOLVED).toBe(1);
    expect(stats.open).toBe(1);
    expect(stats.slaBreached).toBe(1);
    expect(stats.byCategory[0].category).toBe('PLUMBING');
  });

  it('scopes statistics to a single resident when asked', async () => {
    await makeTicket();
    await makeTicket({
      residentId: baseline.resident2.residentId,
      flatId: baseline.flatB.id,
      userId: baseline.resident2.userId,
      title: 'Balcony door hinge is loose',
    });

    const mine = await getComplaintStats({ residentId: baseline.resident.residentId });
    expect(mine.total).toBe(1);
  });
});
