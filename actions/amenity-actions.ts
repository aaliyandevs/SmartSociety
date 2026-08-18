'use server';

import { revalidatePath } from 'next/cache';

import { type ActionState, runAction, success } from '@/lib/action-result';
import { AUDIT_ACTIONS, auditActor, recordAudit } from '@/lib/audit';
import { requireResident, requireRole } from '@/lib/auth/session';
import { NotFoundError } from '@/lib/errors';
import { notify } from '@/lib/notifications';
import prisma from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rate-limit';
import { formatDateTime } from '@/lib/utils';
import {
  amenitySchema,
  bookingSchema,
  cancelBookingSchema,
  reviewBookingSchema,
} from '@/lib/validations/amenity';
import {
  cancelBooking,
  createBooking,
  reviewBooking,
  slugify,
} from '@/services/amenity-service';
import { getSociety } from '@/services/society-service';

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

const checkbox = (formData: FormData, key: string) =>
  formData.get(key) === 'on' || formData.get(key) === 'true';

// ── Resident ──────────────────────────────────────────────────────────────────

export async function createBookingAction(
  _prev: ActionState<{ bookingId: string }>,
  formData: FormData,
): Promise<ActionState<{ bookingId: string }>> {
  return runAction(async () => {
    const user = await requireResident();
    enforceRateLimit(`booking:${user.id}`, 20, 3600);

    const input = bookingSchema.parse({
      amenityId: formValue(formData, 'amenityId'),
      startsAt: formValue(formData, 'startsAt'),
      slots: formValue(formData, 'slots') ?? '1',
      guestsCount: formValue(formData, 'guestsCount') ?? '1',
      purpose: formValue(formData, 'purpose'),
    });

    const booking = await createBooking({
      amenityId: input.amenityId,
      residentId: user.residentId,
      flatId: user.flatId,
      startsAt: input.startsAt,
      slots: input.slots,
      guestsCount: input.guestsCount,
      purpose: input.purpose,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.BOOKING_CREATED,
      entityType: 'AmenityBooking',
      entityId: booking.id,
      description: `Booked ${booking.amenity.name} for ${formatDateTime(booking.startsAt)} (${booking.bookingCode}).`,
      metadata: { amenity: booking.amenity.name, status: booking.status },
      actor: auditActor(user),
    });

    await notify({
      userId: user.id,
      type: 'BOOKING_CONFIRMED',
      title: booking.status === 'PENDING' ? 'Booking submitted for approval' : 'Booking confirmed',
      body:
        booking.status === 'PENDING'
          ? `${booking.amenity.name} on ${formatDateTime(booking.startsAt)} is awaiting committee approval.`
          : `${booking.amenity.name} is reserved for you on ${formatDateTime(booking.startsAt)}.`,
      link: '/resident/amenities',
      entityType: 'AmenityBooking',
      entityId: booking.id,
    });

    revalidatePath('/resident/amenities');
    revalidatePath('/resident');
    revalidatePath('/admin/amenities');

    return success(
      booking.status === 'PENDING'
        ? `Request submitted. ${booking.amenity.name} needs committee approval — you will be notified.`
        : `${booking.amenity.name} booked for ${formatDateTime(booking.startsAt)}. Reference ${booking.bookingCode}.`,
      { bookingId: booking.id },
    );
  });
}

export async function cancelBookingAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('RESIDENT', 'ADMIN');

    const input = cancelBookingSchema.parse({
      bookingId: formValue(formData, 'bookingId'),
      reason: formValue(formData, 'reason'),
    });

    const booking = await cancelBooking({
      bookingId: input.bookingId,
      residentId: user.role === 'RESIDENT' ? user.residentId : null,
      reason: input.reason,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.BOOKING_CANCELLED,
      entityType: 'AmenityBooking',
      entityId: booking.id,
      description: `Cancelled ${booking.amenity.name} booking ${booking.bookingCode}.`,
      metadata: { reason: input.reason },
      actor: auditActor(user),
    });

    revalidatePath('/resident/amenities');
    revalidatePath('/admin/amenities');

    return success(`Booking ${booking.bookingCode} cancelled.`);
  });
}

// ── Administrator ─────────────────────────────────────────────────────────────

export async function reviewBookingAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const input = reviewBookingSchema.parse({
      bookingId: formValue(formData, 'bookingId'),
      decision: formValue(formData, 'decision'),
      reason: formValue(formData, 'reason'),
    });

    const { booking, residentUserId } = await reviewBooking({
      bookingId: input.bookingId,
      decision: input.decision,
      reviewerId: user.id,
      reason: input.reason,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.BOOKING_CREATED,
      entityType: 'AmenityBooking',
      entityId: booking.id,
      description: `${input.decision === 'CONFIRMED' ? 'Approved' : 'Rejected'} booking ${booking.bookingCode} for ${booking.amenity.name}.`,
      actor: auditActor(user),
    });

    await notify({
      userId: residentUserId,
      type: input.decision === 'CONFIRMED' ? 'BOOKING_CONFIRMED' : 'BOOKING_CANCELLED',
      title: input.decision === 'CONFIRMED' ? 'Booking approved' : 'Booking not approved',
      body:
        input.decision === 'CONFIRMED'
          ? `${booking.amenity.name} is confirmed for ${formatDateTime(booking.startsAt)}.`
          : `Your ${booking.amenity.name} request was not approved. ${input.reason ?? ''}`.trim(),
      link: '/resident/amenities',
      entityType: 'AmenityBooking',
      entityId: booking.id,
    });

    revalidatePath('/admin/amenities');
    revalidatePath('/resident/amenities');

    return success(input.decision === 'CONFIRMED' ? 'Booking approved.' : 'Booking rejected.');
  });
}

export async function saveAmenityAction(
  _prev: ActionState<{ amenityId: string }>,
  formData: FormData,
): Promise<ActionState<{ amenityId: string }>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const amenityId = formValue(formData, 'amenityId');

    const input = amenitySchema.parse({
      name: formValue(formData, 'name'),
      description: formValue(formData, 'description'),
      location: formValue(formData, 'location'),
      capacity: formValue(formData, 'capacity'),
      openMinute: formValue(formData, 'openMinute'),
      closeMinute: formValue(formData, 'closeMinute'),
      slotMinutes: formValue(formData, 'slotMinutes'),
      bookingFee: formValue(formData, 'bookingFee') ?? '0',
      maxAdvanceDays: formValue(formData, 'maxAdvanceDays'),
      minCancelHours: formValue(formData, 'minCancelHours'),
      maxSlotsPerBooking: formValue(formData, 'maxSlotsPerBooking'),
      requiresApproval: checkbox(formData, 'requiresApproval'),
      isActive: checkbox(formData, 'isActive'),
    });

    if (amenityId) {
      const existing = await prisma.amenity.findFirst({
        where: { id: amenityId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw new NotFoundError('That amenity could not be found.');

      const updated = await prisma.amenity.update({ where: { id: amenityId }, data: input });

      await recordAudit({
        action: AUDIT_ACTIONS.AMENITY_UPDATED,
        entityType: 'Amenity',
        entityId: updated.id,
        description: `Updated amenity "${updated.name}".`,
        actor: auditActor(user),
      });

      revalidatePath('/admin/amenities');
      revalidatePath('/resident/amenities');
      return success(`${updated.name} updated.`, { amenityId: updated.id });
    }

    const society = await getSociety();
    // Slugs are unique; disambiguate rather than failing the whole save.
    const base = slugify(input.name);
    let slug = base;
    let suffix = 1;
    while (await prisma.amenity.findUnique({ where: { slug }, select: { id: true } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    const created = await prisma.amenity.create({
      data: { ...input, slug, societyId: society.id },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.AMENITY_CREATED,
      entityType: 'Amenity',
      entityId: created.id,
      description: `Created amenity "${created.name}".`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/amenities');
    revalidatePath('/resident/amenities');
    return success(`${created.name} added.`, { amenityId: created.id });
  });
}

export async function toggleAmenityAction(amenityId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const amenity = await prisma.amenity.findFirst({
      where: { id: amenityId, deletedAt: null },
      select: { id: true, name: true, isActive: true },
    });
    if (!amenity) throw new NotFoundError('That amenity could not be found.');

    await prisma.amenity.update({ where: { id: amenity.id }, data: { isActive: !amenity.isActive } });

    await recordAudit({
      action: AUDIT_ACTIONS.AMENITY_UPDATED,
      entityType: 'Amenity',
      entityId: amenity.id,
      description: `${amenity.isActive ? 'Closed' : 'Reopened'} bookings for "${amenity.name}".`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/amenities');
    revalidatePath('/resident/amenities');

    return success(
      amenity.isActive ? `${amenity.name} is now closed for bookings.` : `${amenity.name} is open for bookings.`,
    );
  });
}
