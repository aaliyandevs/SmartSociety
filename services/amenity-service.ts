import 'server-only';

import { type Amenity, Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { generateBookingCode } from '@/lib/codes';

/**
 * Facility & amenity booking (SRS §1.6, Residents #5).
 *
 * Conflicts are prevented at two levels:
 *   1. a unique index on (amenityId, startsAt, status) makes two CONFIRMED
 *      bookings of the same slot impossible at the database level, and
 *   2. an overlap check inside a serializable transaction catches multi-slot
 *      bookings that straddle an existing reservation.
 */

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  available: boolean;
  bookedBy: string | null;
  isPast: boolean;
  mine: boolean;
}

/** Builds the slot grid for one amenity on one day, marking what is taken. */
export async function getDaySlots(
  amenity: Pick<Amenity, 'id' | 'openMinute' | 'closeMinute' | 'slotMinutes'>,
  day: Date,
  currentResidentId?: string | null,
): Promise<Slot[]> {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const bookings = await prisma.amenityBooking.findMany({
    where: {
      amenityId: amenity.id,
      status: { in: ['CONFIRMED', 'PENDING', 'COMPLETED'] },
      startsAt: { gte: dayStart, lt: dayEnd },
    },
    select: {
      startsAt: true,
      endsAt: true,
      residentId: true,
      flat: { select: { flatNumber: true, block: { select: { name: true } } } },
    },
  });

  const slots: Slot[] = [];
  const now = new Date();

  for (
    let minute = amenity.openMinute;
    minute + amenity.slotMinutes <= amenity.closeMinute;
    minute += amenity.slotMinutes
  ) {
    const startsAt = new Date(dayStart.getTime() + minute * 60_000);
    const endsAt = new Date(startsAt.getTime() + amenity.slotMinutes * 60_000);

    const clash = bookings.find(
      (booking) => booking.startsAt < endsAt && booking.endsAt > startsAt,
    );

    slots.push({
      startsAt,
      endsAt,
      available: !clash,
      bookedBy: clash ? `${clash.flat.block.name}-${clash.flat.flatNumber}` : null,
      isPast: endsAt <= now,
      mine: Boolean(clash && currentResidentId && clash.residentId === currentResidentId),
    });
  }

  return slots;
}

export interface CreateBookingInput {
  amenityId: string;
  residentId: string;
  flatId: string;
  startsAt: Date;
  slots: number;
  guestsCount: number;
  purpose?: string | null;
}

export async function createBooking(input: CreateBookingInput) {
  const amenity = await prisma.amenity.findFirst({
    where: { id: input.amenityId, deletedAt: null },
  });
  if (!amenity) throw new NotFoundError('That amenity is not available.');
  if (!amenity.isActive) throw new ConflictError(`${amenity.name} is currently closed for bookings.`);

  const slots = Math.min(input.slots, amenity.maxSlotsPerBooking);
  const endsAt = new Date(input.startsAt.getTime() + slots * amenity.slotMinutes * 60_000);
  const now = new Date();

  // ── Business rules ──
  if (input.startsAt <= now) {
    throw new AppError('Pick a slot in the future.', {
      fieldErrors: { startsAt: ['Pick a slot in the future.'] },
    });
  }

  const maxAdvance = new Date(now.getTime() + amenity.maxAdvanceDays * 86_400_000);
  if (input.startsAt > maxAdvance) {
    throw new AppError(
      `${amenity.name} can only be booked up to ${amenity.maxAdvanceDays} days in advance.`,
      { fieldErrors: { startsAt: [`Bookings open ${amenity.maxAdvanceDays} days ahead.`] } },
    );
  }

  if (input.guestsCount > amenity.capacity) {
    throw new AppError(`${amenity.name} has a capacity of ${amenity.capacity} people.`, {
      fieldErrors: { guestsCount: [`Maximum ${amenity.capacity} people.`] },
    });
  }

  // The slot must line up with the amenity's grid.
  const minutesFromMidnight = input.startsAt.getHours() * 60 + input.startsAt.getMinutes();
  const offset = minutesFromMidnight - amenity.openMinute;
  if (offset < 0 || offset % amenity.slotMinutes !== 0) {
    throw new AppError('That start time is not one of the bookable slots.', {
      fieldErrors: { startsAt: ['Choose one of the listed time slots.'] },
    });
  }
  const endMinutes = minutesFromMidnight + slots * amenity.slotMinutes;
  if (endMinutes > amenity.closeMinute) {
    throw new AppError(`${amenity.name} closes before that booking would end.`, {
      fieldErrors: { slots: ['Reduce the number of slots.'] },
    });
  }

  const status = amenity.requiresApproval ? 'PENDING' : 'CONFIRMED';

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Overlap check — covers multi-slot bookings the unique index alone
        // would not catch.
        const clash = await tx.amenityBooking.findFirst({
          where: {
            amenityId: amenity.id,
            status: { in: ['CONFIRMED', 'PENDING'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: input.startsAt },
          },
          select: { id: true, startsAt: true },
        });

        if (clash) {
          throw new ConflictError(
            'That time slot has just been taken by another resident. Please pick a different slot.',
          );
        }

        // One resident may not hold two overlapping bookings anywhere.
        const ownClash = await tx.amenityBooking.findFirst({
          where: {
            residentId: input.residentId,
            status: { in: ['CONFIRMED', 'PENDING'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: input.startsAt },
          },
          select: { id: true },
        });
        if (ownClash) {
          throw new ConflictError('You already have another booking that overlaps this time.');
        }

        return tx.amenityBooking.create({
          data: {
            bookingCode: generateBookingCode(),
            amenityId: amenity.id,
            residentId: input.residentId,
            flatId: input.flatId,
            startsAt: input.startsAt,
            endsAt,
            guestsCount: input.guestsCount,
            purpose: input.purpose ?? null,
            fee: new Prisma.Decimal(Number(amenity.bookingFee) * slots),
            status,
          },
          include: { amenity: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    // The unique index is the last line of defence against a race.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError(
        'That time slot has just been booked by another resident. Please pick a different slot.',
      );
    }
    throw error;
  }
}

export async function cancelBooking(input: {
  bookingId: string;
  /** Non-null restricts the cancellation to the booking's owner. */
  residentId: string | null;
  reason?: string | null;
}) {
  const booking = await prisma.amenityBooking.findUnique({
    where: { id: input.bookingId },
    include: { amenity: true },
  });

  if (!booking) throw new NotFoundError('That booking no longer exists.');
  if (input.residentId && booking.residentId !== input.residentId) {
    throw new NotFoundError('That booking no longer exists.');
  }
  if (booking.status === 'CANCELLED') throw new ConflictError('This booking is already cancelled.');
  if (booking.status === 'COMPLETED') throw new ConflictError('This booking has already taken place.');

  // Residents are bound by the cancellation window; administrators are not.
  if (input.residentId) {
    const cutoff = new Date(booking.startsAt.getTime() - booking.amenity.minCancelHours * 3_600_000);
    if (new Date() > cutoff) {
      throw new ConflictError(
        `${booking.amenity.name} bookings can only be cancelled up to ${booking.amenity.minCancelHours} hours before the slot starts. Please contact the society office.`,
      );
    }
  }

  return prisma.amenityBooking.update({
    where: { id: booking.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: input.reason ?? null },
    include: { amenity: true },
  });
}

export async function reviewBooking(input: {
  bookingId: string;
  decision: 'CONFIRMED' | 'REJECTED';
  reviewerId: string;
  reason?: string | null;
}) {
  const booking = await prisma.amenityBooking.findUnique({
    where: { id: input.bookingId },
    include: { amenity: true, resident: { select: { userId: true } } },
  });

  if (!booking) throw new NotFoundError('That booking no longer exists.');
  if (booking.status !== 'PENDING') {
    throw new ConflictError('This booking has already been reviewed.');
  }

  const updated = await prisma.amenityBooking.update({
    where: { id: booking.id },
    data: {
      status: input.decision,
      reviewedById: input.reviewerId,
      cancelReason: input.decision === 'REJECTED' ? (input.reason ?? 'Not approved') : null,
      cancelledAt: input.decision === 'REJECTED' ? new Date() : null,
    },
    include: { amenity: true },
  });

  return { booking: updated, residentUserId: booking.resident.userId };
}

/** Marks past confirmed bookings as completed so the calendar stays honest. */
export async function completeElapsedBookings(): Promise<number> {
  const result = await prisma.amenityBooking.updateMany({
    where: { status: 'CONFIRMED', endsAt: { lt: new Date() } },
    data: { status: 'COMPLETED' },
  });
  return result.count;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
