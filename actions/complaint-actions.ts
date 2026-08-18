'use server';

import { revalidatePath } from 'next/cache';

import { type ActionState, runAction, success } from '@/lib/action-result';
import { AUDIT_ACTIONS, auditActor, recordAudit } from '@/lib/audit';
import { requireResident, requireRole } from '@/lib/auth/session';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { notify, notifyRoles } from '@/lib/notifications';
import prisma from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rate-limit';
import { humanise } from '@/lib/utils';
import {
  complaintAssignSchema,
  complaintCreateSchema,
  complaintFeedbackSchema,
  complaintNoteSchema,
  complaintStatusSchema2,
} from '@/lib/validations/complaint';
import {
  addComplaintNote,
  assignComplaint,
  attachComplaintFile,
  changeComplaintStatus,
  createComplaint,
} from '@/services/complaint-service';
import { MAX_ATTACHMENTS_PER_COMPLAINT, storeUpload } from '@/services/upload-service';

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

// ── Resident ──────────────────────────────────────────────────────────────────

export async function createComplaintAction(
  _prev: ActionState<{ complaintId: string; ticketNumber: string }>,
  formData: FormData,
): Promise<ActionState<{ complaintId: string; ticketNumber: string }>> {
  return runAction(async () => {
    const user = await requireResident();
    enforceRateLimit(`complaint:create:${user.id}`, 10, 3600);

    const input = complaintCreateSchema.parse({
      title: formValue(formData, 'title'),
      category: formValue(formData, 'category'),
      priority: formValue(formData, 'priority') ?? 'MEDIUM',
      description: formValue(formData, 'description'),
      location: formValue(formData, 'location'),
    });

    const complaint = await createComplaint({
      residentId: user.residentId,
      flatId: user.flatId,
      userId: user.id,
      title: input.title,
      category: input.category,
      priority: input.priority,
      description: input.description,
      location: input.location,
    });

    // Photo uploads are validated (type, magic bytes, size) in the upload service.
    const files = formData
      .getAll('photos')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .slice(0, MAX_ATTACHMENTS_PER_COMPLAINT);

    const attachmentErrors: string[] = [];
    for (const file of files) {
      try {
        const stored = await storeUpload(file, `complaints/${complaint.id}`.replace('/', '-'));
        await attachComplaintFile({ complaintId: complaint.id, ...stored });
      } catch (error) {
        attachmentErrors.push(error instanceof AppError ? error.message : `Could not save "${file.name}".`);
      }
    }

    const flatLabel = `${complaint.flat.block.name}-${complaint.flat.flatNumber}`;

    await recordAudit({
      action: AUDIT_ACTIONS.COMPLAINT_CREATED,
      entityType: 'Complaint',
      entityId: complaint.id,
      description: `Raised ticket ${complaint.ticketNumber} (${humanise(input.category)}, ${humanise(input.priority)}) for flat ${flatLabel}.`,
      metadata: { ticketNumber: complaint.ticketNumber, attachments: files.length },
      actor: auditActor(user),
    });

    await notifyRoles(['ADMIN'], {
      type: 'COMPLAINT_CREATED',
      title: `New ${humanise(input.category).toLowerCase()} ticket`,
      body: `${complaint.ticketNumber} — ${input.title} (flat ${flatLabel}).`,
      link: `/admin/complaints/${complaint.id}`,
      entityType: 'Complaint',
      entityId: complaint.id,
      isUrgent: input.priority === 'CRITICAL',
    });

    revalidatePath('/resident/complaints');
    revalidatePath('/resident');
    revalidatePath('/admin/complaints');

    const message = attachmentErrors.length
      ? `Ticket ${complaint.ticketNumber} raised, but some photos could not be saved: ${attachmentErrors[0]}`
      : `Ticket ${complaint.ticketNumber} raised. You will be notified as it progresses.`;

    return success(message, { complaintId: complaint.id, ticketNumber: complaint.ticketNumber });
  });
}

export async function rateComplaintAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireResident();
    const input = complaintFeedbackSchema.parse({
      complaintId: formValue(formData, 'complaintId'),
      satisfaction: formValue(formData, 'satisfaction'),
    });

    const complaint = await prisma.complaint.findFirst({
      where: { id: input.complaintId, residentId: user.residentId, deletedAt: null },
      select: { id: true, status: true, ticketNumber: true },
    });
    if (!complaint) throw new NotFoundError('That ticket could not be found.');
    if (complaint.status !== 'RESOLVED' && complaint.status !== 'CLOSED') {
      throw new AppError('You can rate a ticket once it has been resolved.');
    }

    await prisma.complaint.update({
      where: { id: complaint.id },
      data: { satisfaction: input.satisfaction },
    });

    revalidatePath(`/resident/complaints/${complaint.id}`);
    return success('Thanks for the feedback.');
  });
}

// ── Administrator ─────────────────────────────────────────────────────────────

export async function assignComplaintAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const input = complaintAssignSchema.parse({
      complaintId: formValue(formData, 'complaintId'),
      staffId: formValue(formData, 'staffId'),
      priority: formValue(formData, 'priority') || undefined,
      note: formValue(formData, 'note'),
    });

    const { complaint, staffUserId, staffName } = await assignComplaint({
      complaintId: input.complaintId,
      staffId: input.staffId,
      actorId: user.id,
      priority: input.priority,
      note: input.note,
    });

    const flatLabel = `${complaint.flat.block.name}-${complaint.flat.flatNumber}`;

    await recordAudit({
      action: AUDIT_ACTIONS.COMPLAINT_ASSIGNED,
      entityType: 'Complaint',
      entityId: complaint.id,
      description: `Assigned ticket ${complaint.ticketNumber} to ${staffName}.`,
      metadata: { ticketNumber: complaint.ticketNumber, staffName, priority: complaint.priority },
      actor: auditActor(user),
    });

    await notify({
      userId: staffUserId,
      type: 'COMPLAINT_ASSIGNED',
      title: 'New ticket assigned to you',
      body: `${complaint.ticketNumber} — ${complaint.title} (flat ${flatLabel}). Due ${complaint.slaDueAt.toLocaleString('en-IN')}.`,
      link: `/staff/tickets/${complaint.id}`,
      entityType: 'Complaint',
      entityId: complaint.id,
      isUrgent: complaint.priority === 'CRITICAL' || complaint.priority === 'HIGH',
    });

    await notify({
      userId: complaint.resident.user.id,
      type: 'COMPLAINT_UPDATED',
      title: 'A technician has been assigned',
      body: `${staffName} will handle ${complaint.ticketNumber} — ${complaint.title}.`,
      link: `/resident/complaints/${complaint.id}`,
      entityType: 'Complaint',
      entityId: complaint.id,
    });

    revalidatePath('/admin/complaints');
    revalidatePath(`/admin/complaints/${complaint.id}`);
    revalidatePath('/staff');

    return success(`Ticket assigned to ${staffName}.`);
  });
}

// ── Shared: status change & notes (admin + assigned technician) ───────────────

export async function updateComplaintStatusAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN', 'MAINTENANCE_STAFF');

    const input = complaintStatusSchema2.parse({
      complaintId: formValue(formData, 'complaintId'),
      status: formValue(formData, 'status'),
      note: formValue(formData, 'note'),
      isInternal: formData.get('isInternal') === 'on' || formData.get('isInternal') === 'true',
      resolutionNotes: formValue(formData, 'resolutionNotes'),
    });

    // A technician may only touch tickets assigned to them.
    const restrictToStaffId = user.role === 'MAINTENANCE_STAFF' ? user.staffId : null;
    if (user.role === 'MAINTENANCE_STAFF' && !restrictToStaffId) {
      throw new ForbiddenError('Your staff profile is not set up. Contact the society office.');
    }

    const { complaint, residentUserId, previousStatus } = await changeComplaintStatus({
      complaintId: input.complaintId,
      status: input.status,
      actorId: user.id,
      note: input.note,
      isInternal: input.isInternal,
      resolutionNotes: input.resolutionNotes,
      restrictToStaffId,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.COMPLAINT_STATUS_CHANGED,
      entityType: 'Complaint',
      entityId: complaint.id,
      description: `Ticket ${complaint.ticketNumber} moved from ${previousStatus} to ${input.status}.`,
      metadata: { ticketNumber: complaint.ticketNumber, from: previousStatus, to: input.status },
      actor: auditActor(user),
    });

    // Internal notes are never surfaced to the resident.
    if (!input.isInternal) {
      await notify({
        userId: residentUserId,
        type: input.status === 'RESOLVED' ? 'COMPLAINT_RESOLVED' : 'COMPLAINT_UPDATED',
        title:
          input.status === 'RESOLVED'
            ? 'Your ticket has been resolved'
            : `Ticket ${humanise(input.status).toLowerCase()}`,
        body: `${complaint.ticketNumber} — ${complaint.title}. ${input.note}`,
        link: `/resident/complaints/${complaint.id}`,
        entityType: 'Complaint',
        entityId: complaint.id,
      });
    }

    revalidatePath('/admin/complaints');
    revalidatePath(`/admin/complaints/${complaint.id}`);
    revalidatePath('/staff');
    revalidatePath('/staff/tickets');
    revalidatePath(`/staff/tickets/${complaint.id}`);
    revalidatePath(`/resident/complaints/${complaint.id}`);

    return success(`Ticket ${complaint.ticketNumber} is now ${humanise(input.status).toLowerCase()}.`);
  });
}

export async function addComplaintNoteAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN', 'MAINTENANCE_STAFF', 'RESIDENT');

    const input = complaintNoteSchema.parse({
      complaintId: formValue(formData, 'complaintId'),
      note: formValue(formData, 'note'),
      isInternal: formData.get('isInternal') === 'on' || formData.get('isInternal') === 'true',
    });

    // Residents can comment on their own tickets, but never internally.
    if (user.role === 'RESIDENT') {
      const owned = await prisma.complaint.findFirst({
        where: { id: input.complaintId, residentId: user.residentId ?? '__none__' },
        select: { id: true },
      });
      if (!owned) throw new NotFoundError('That ticket could not be found.');
      input.isInternal = false;
    }

    const { residentUserId, ticketNumber } = await addComplaintNote({
      complaintId: input.complaintId,
      actorId: user.id,
      note: input.note,
      isInternal: input.isInternal,
      restrictToStaffId: user.role === 'MAINTENANCE_STAFF' ? user.staffId : null,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.COMPLAINT_NOTE_ADDED,
      entityType: 'Complaint',
      entityId: input.complaintId,
      description: `Added a ${input.isInternal ? 'internal' : 'public'} note to ticket ${ticketNumber}.`,
      actor: auditActor(user),
    });

    if (!input.isInternal && user.role !== 'RESIDENT') {
      await notify({
        userId: residentUserId,
        type: 'COMPLAINT_UPDATED',
        title: 'New update on your ticket',
        body: `${ticketNumber}: ${input.note}`,
        link: `/resident/complaints/${input.complaintId}`,
        entityType: 'Complaint',
        entityId: input.complaintId,
      });
    }

    revalidatePath(`/admin/complaints/${input.complaintId}`);
    revalidatePath(`/staff/tickets/${input.complaintId}`);
    revalidatePath(`/resident/complaints/${input.complaintId}`);

    return success('Note added to the ticket.');
  });
}
