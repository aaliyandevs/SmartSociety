import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import {
  cancelBooking,
  completeElapsedBookings,
  createBooking,
  getDaySlots,
  reviewBooking,
} from '@/services/amenity-service';
import { castVote, closeElapsedPolls, tallyPoll, pollWithResultsInclude } from '@/services/community-service';
import { prisma, resetDatabase, seedBaseline, type Baseline } from '../setup/fixtures';

let baseline: Baseline;

/** Tomorrow at the given hour, aligned to the amenity's 60-minute grid. */
function slotAt(hour: number, daysAhead = 1): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  return date;
}

beforeAll(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('amenity booking', () => {
  beforeEach(async () => {
    await prisma.amenityBooking.deleteMany();
  });

  it('creates a confirmed booking with a fee and a reference code', async () => {
    const booking = await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident.residentId,
      flatId: baseline.flatA.id,
      startsAt: slotAt(10),
      slots: 1,
      guestsCount: 4,
      purpose: 'Family gathering',
    });

    expect(booking.status).toBe('CONFIRMED');
    expect(booking.bookingCode).toMatch(/^BK-[0-9A-Z]{6}$/);
    expect(Number(booking.fee)).toBe(500);
    expect(booking.endsAt.getTime() - booking.startsAt.getTime()).toBe(60 * 60_000);
  });

  it('charges per slot for a multi-slot booking', async () => {
    const booking = await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident.residentId,
      flatId: baseline.flatA.id,
      startsAt: slotAt(14),
      slots: 3,
      guestsCount: 10,
    });

    expect(Number(booking.fee)).toBe(1500);
    expect(booking.endsAt.getTime() - booking.startsAt.getTime()).toBe(3 * 60 * 60_000);
  });

  it('prevents a second resident from booking the same slot', async () => {
    const startsAt = slotAt(11);

    await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident.residentId,
      flatId: baseline.flatA.id,
      startsAt,
      slots: 1,
      guestsCount: 2,
    });

    await expect(
      createBooking({
        amenityId: baseline.amenity.id,
        residentId: baseline.resident2.residentId,
        flatId: baseline.flatB.id,
        startsAt,
        slots: 1,
        guestsCount: 2,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('prevents a multi-slot booking that straddles an existing one', async () => {
    await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident.residentId,
      flatId: baseline.flatA.id,
      startsAt: slotAt(12),
      slots: 1,
      guestsCount: 2,
    });

    // 11:00–14:00 overlaps the 12:00 slot even though it starts elsewhere.
    await expect(
      createBooking({
        amenityId: baseline.amenity.id,
        residentId: baseline.resident2.residentId,
        flatId: baseline.flatB.id,
        startsAt: slotAt(11),
        slots: 3,
        guestsCount: 2,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('stops one resident holding two overlapping bookings', async () => {
    await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident.residentId,
      flatId: baseline.flatA.id,
      startsAt: slotAt(9),
      slots: 2,
      guestsCount: 2,
    });

    await expect(
      createBooking({
        amenityId: baseline.amenity.id,
        residentId: baseline.resident.residentId,
        flatId: baseline.flatA.id,
        startsAt: slotAt(10),
        slots: 1,
        guestsCount: 2,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('refuses a booking in the past', async () => {
    await expect(
      createBooking({
        amenityId: baseline.amenity.id,
        residentId: baseline.resident.residentId,
        flatId: baseline.flatA.id,
        startsAt: slotAt(10, -1),
        slots: 1,
        guestsCount: 2,
      }),
    ).rejects.toThrow(AppError);
  });

  it('refuses a start time that is not on the slot grid', async () => {
    const misaligned = slotAt(10);
    misaligned.setMinutes(30);

    await expect(
      createBooking({
        amenityId: baseline.amenity.id,
        residentId: baseline.resident.residentId,
        flatId: baseline.flatA.id,
        startsAt: misaligned,
        slots: 1,
        guestsCount: 2,
      }),
    ).rejects.toThrow(/bookable slots/);
  });

  it('refuses a booking that runs past closing time', async () => {
    // The amenity closes at 20:00; 19:00 + 3 slots would end at 22:00.
    await expect(
      createBooking({
        amenityId: baseline.amenity.id,
        residentId: baseline.resident.residentId,
        flatId: baseline.flatA.id,
        startsAt: slotAt(19),
        slots: 3,
        guestsCount: 2,
      }),
    ).rejects.toThrow(/closes before/);
  });

  it('refuses a party larger than the capacity', async () => {
    await expect(
      createBooking({
        amenityId: baseline.amenity.id,
        residentId: baseline.resident.residentId,
        flatId: baseline.flatA.id,
        startsAt: slotAt(10),
        slots: 1,
        guestsCount: 500,
      }),
    ).rejects.toThrow(/capacity/);
  });

  it('refuses a booking beyond the advance-booking window', async () => {
    await expect(
      createBooking({
        amenityId: baseline.amenity.id,
        residentId: baseline.resident.residentId,
        flatId: baseline.flatA.id,
        startsAt: slotAt(10, 90),
        slots: 1,
        guestsCount: 2,
      }),
    ).rejects.toThrow(/days in advance/);
  });

  it('refuses a booking for a closed amenity', async () => {
    await prisma.amenity.update({ where: { id: baseline.amenity.id }, data: { isActive: false } });

    await expect(
      createBooking({
        amenityId: baseline.amenity.id,
        residentId: baseline.resident.residentId,
        flatId: baseline.flatA.id,
        startsAt: slotAt(10),
        slots: 1,
        guestsCount: 2,
      }),
    ).rejects.toThrow(/closed for bookings/);

    await prisma.amenity.update({ where: { id: baseline.amenity.id }, data: { isActive: true } });
  });

  it('marks the slot grid so a taken slot is not offered again', async () => {
    const startsAt = slotAt(15);
    await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident.residentId,
      flatId: baseline.flatA.id,
      startsAt,
      slots: 1,
      guestsCount: 2,
    });

    const amenity = await prisma.amenity.findUniqueOrThrow({ where: { id: baseline.amenity.id } });
    const slots = await getDaySlots(amenity, startsAt, baseline.resident.residentId);

    const taken = slots.find((slot) => slot.startsAt.getTime() === startsAt.getTime());
    expect(taken?.available).toBe(false);
    expect(taken?.mine).toBe(true);
    expect(taken?.bookedBy).toBe('A-101');

    // 12 hours of opening at 60 minutes each.
    expect(slots).toHaveLength(12);
  });

  it('frees the slot again once the booking is cancelled', async () => {
    const startsAt = slotAt(16);
    const booking = await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident.residentId,
      flatId: baseline.flatA.id,
      startsAt,
      slots: 1,
      guestsCount: 2,
    });

    await cancelBooking({ bookingId: booking.id, residentId: baseline.resident.residentId });

    // Another resident can now take it.
    const replacement = await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident2.residentId,
      flatId: baseline.flatB.id,
      startsAt,
      slots: 1,
      guestsCount: 2,
    });
    expect(replacement.status).toBe('CONFIRMED');
  });

  it('enforces the cancellation window for residents but not for the office', async () => {
    const soon = new Date(Date.now() + 2 * 3_600_000);
    soon.setMinutes(0, 0, 0);

    // Create it directly so the "in the future" rule does not interfere.
    const booking = await prisma.amenityBooking.create({
      data: {
        bookingCode: 'BK-TEST01',
        amenityId: baseline.amenity.id,
        residentId: baseline.resident.residentId,
        flatId: baseline.flatA.id,
        startsAt: soon,
        endsAt: new Date(soon.getTime() + 3_600_000),
        guestsCount: 2,
        status: 'CONFIRMED',
      },
    });

    // The amenity's window is four hours, and this starts in two.
    await expect(
      cancelBooking({ bookingId: booking.id, residentId: baseline.resident.residentId }),
    ).rejects.toThrow(/hours before/);

    // An administrator (residentId = null) is not bound by the window.
    const cancelled = await cancelBooking({ bookingId: booking.id, residentId: null });
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('hides another resident’s booking rather than revealing it exists', async () => {
    const booking = await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident.residentId,
      flatId: baseline.flatA.id,
      startsAt: slotAt(17),
      slots: 1,
      guestsCount: 2,
    });

    await expect(
      cancelBooking({ bookingId: booking.id, residentId: baseline.resident2.residentId }),
    ).rejects.toThrow(NotFoundError);
  });

  it('holds an approval-required booking as PENDING until reviewed', async () => {
    await prisma.amenity.update({
      where: { id: baseline.amenity.id },
      data: { requiresApproval: true },
    });

    const booking = await createBooking({
      amenityId: baseline.amenity.id,
      residentId: baseline.resident.residentId,
      flatId: baseline.flatA.id,
      startsAt: slotAt(18),
      slots: 1,
      guestsCount: 2,
    });
    expect(booking.status).toBe('PENDING');

    const reviewed = await reviewBooking({
      bookingId: booking.id,
      decision: 'CONFIRMED',
      reviewerId: baseline.admin.id,
    });
    expect(reviewed.booking.status).toBe('CONFIRMED');

    // A second review is refused.
    await expect(
      reviewBooking({ bookingId: booking.id, decision: 'REJECTED', reviewerId: baseline.admin.id }),
    ).rejects.toThrow(ConflictError);

    await prisma.amenity.update({
      where: { id: baseline.amenity.id },
      data: { requiresApproval: false },
    });
  });

  it('marks elapsed confirmed bookings as completed', async () => {
    const past = new Date(Date.now() - 3 * 3_600_000);
    past.setMinutes(0, 0, 0);

    await prisma.amenityBooking.create({
      data: {
        bookingCode: 'BK-TEST02',
        amenityId: baseline.amenity.id,
        residentId: baseline.resident.residentId,
        flatId: baseline.flatA.id,
        startsAt: past,
        endsAt: new Date(past.getTime() + 3_600_000),
        guestsCount: 2,
        status: 'CONFIRMED',
      },
    });

    const count = await completeElapsedBookings();
    expect(count).toBeGreaterThanOrEqual(1);

    const updated = await prisma.amenityBooking.findFirstOrThrow({
      where: { bookingCode: 'BK-TEST02' },
    });
    expect(updated.status).toBe('COMPLETED');
  });
});

describe('community polling', () => {
  async function makePoll(overrides: { status?: 'DRAFT' | 'ACTIVE' | 'CLOSED'; endsAt?: Date } = {}) {
    return prisma.poll.create({
      data: {
        title: 'Should the society install rooftop solar panels?',
        description: 'A 60 kW plant funded from the sinking fund.',
        status: overrides.status ?? 'ACTIVE',
        startsAt: new Date(Date.now() - 86_400_000),
        endsAt: overrides.endsAt ?? new Date(Date.now() + 7 * 86_400_000),
        authorId: baseline.admin.id,
        options: {
          create: [
            { label: 'Yes, proceed', sortOrder: 0 },
            { label: 'No, defer', sortOrder: 1 },
          ],
        },
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  beforeEach(async () => {
    await prisma.pollVote.deleteMany();
    await prisma.pollOption.deleteMany();
    await prisma.poll.deleteMany();
  });

  it('records a vote', async () => {
    const poll = await makePoll();
    const result = await castVote({
      pollId: poll.id,
      optionId: poll.options[0].id,
      residentId: baseline.resident.residentId,
    });

    expect(result.optionLabel).toBe('Yes, proceed');
    expect(await prisma.pollVote.count({ where: { pollId: poll.id } })).toBe(1);
  });

  it('refuses a second vote from the same resident', async () => {
    const poll = await makePoll();
    await castVote({
      pollId: poll.id,
      optionId: poll.options[0].id,
      residentId: baseline.resident.residentId,
    });

    await expect(
      castVote({
        pollId: poll.id,
        optionId: poll.options[1].id,
        residentId: baseline.resident.residentId,
      }),
    ).rejects.toThrow(/already voted/);

    expect(await prisma.pollVote.count({ where: { pollId: poll.id } })).toBe(1);
  });

  it('is protected by a database constraint, not just application logic', async () => {
    const poll = await makePoll();
    await castVote({
      pollId: poll.id,
      optionId: poll.options[0].id,
      residentId: baseline.resident.residentId,
    });

    // Bypass the service entirely — the unique index must still reject it.
    await expect(
      prisma.pollVote.create({
        data: {
          pollId: poll.id,
          optionId: poll.options[1].id,
          residentId: baseline.resident.residentId,
        },
      }),
    ).rejects.toThrow();
  });

  it('allows different residents to vote in the same poll', async () => {
    const poll = await makePoll();
    await castVote({
      pollId: poll.id,
      optionId: poll.options[0].id,
      residentId: baseline.resident.residentId,
    });
    await castVote({
      pollId: poll.id,
      optionId: poll.options[1].id,
      residentId: baseline.resident2.residentId,
    });

    expect(await prisma.pollVote.count({ where: { pollId: poll.id } })).toBe(2);
  });

  it('refuses a vote on a draft or a closed poll', async () => {
    const draft = await makePoll({ status: 'DRAFT' });
    await expect(
      castVote({
        pollId: draft.id,
        optionId: draft.options[0].id,
        residentId: baseline.resident.residentId,
      }),
    ).rejects.toThrow(/not opened/);

    await prisma.pollVote.deleteMany();
    const closed = await prisma.poll.update({
      where: { id: draft.id },
      data: { status: 'CLOSED' },
      include: { options: true },
    });
    await expect(
      castVote({
        pollId: closed.id,
        optionId: closed.options[0].id,
        residentId: baseline.resident.residentId,
      }),
    ).rejects.toThrow(/has closed/);
  });

  it('refuses an option that belongs to a different poll', async () => {
    const pollA = await makePoll();
    const pollB = await makePoll();

    await expect(
      castVote({
        pollId: pollA.id,
        optionId: pollB.options[0].id,
        residentId: baseline.resident.residentId,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('tallies votes into counts and percentages', async () => {
    const poll = await makePoll();
    await castVote({
      pollId: poll.id,
      optionId: poll.options[0].id,
      residentId: baseline.resident.residentId,
    });
    await castVote({
      pollId: poll.id,
      optionId: poll.options[0].id,
      residentId: baseline.resident2.residentId,
    });

    const withResults = await prisma.poll.findUniqueOrThrow({
      where: { id: poll.id },
      include: pollWithResultsInclude,
    });
    const tally = tallyPoll(withResults);

    expect(tally.total).toBe(2);
    expect(tally.results[0].votes).toBe(2);
    expect(tally.results[0].percent).toBe(100);
    expect(tally.results[1].percent).toBe(0);
  });

  it('closes polls whose end date has passed', async () => {
    await makePoll({ endsAt: new Date(Date.now() - 86_400_000) });
    const closed = await closeElapsedPolls();
    expect(closed).toBeGreaterThanOrEqual(1);
    expect(await prisma.poll.count({ where: { status: 'ACTIVE' } })).toBe(0);
  });
});
