import 'server-only';

import { Prisma, type NoticeAudience, type Role } from '@prisma/client';

import prisma from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';

/**
 * Notice board, digital polling and emergency alerts
 * (SRS §1.6, Residents #6 and Common Features).
 */

// ── Notices ───────────────────────────────────────────────────────────────────

/** Only notices that are published, in-window and aimed at this viewer. */
export function visibleNoticeWhere(role: Role, residentType?: 'OWNER' | 'TENANT' | null) {
  const now = new Date();
  const audiences: NoticeAudience[] = [];

  if (role === 'RESIDENT') {
    audiences.push('ALL', 'RESIDENTS');
    if (residentType === 'OWNER') audiences.push('OWNERS');
    if (residentType === 'TENANT') audiences.push('TENANTS');
  } else if (role === 'GUARD' || role === 'MAINTENANCE_STAFF') {
    audiences.push('ALL', 'STAFF');
  } else {
    audiences.push('ALL', 'RESIDENTS', 'OWNERS', 'TENANTS', 'STAFF');
  }

  return {
    deletedAt: null,
    isPublished: true,
    publishAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    audience: { in: audiences },
  } satisfies Prisma.NoticeWhereInput;
}

// ── Polls ─────────────────────────────────────────────────────────────────────

export const pollWithResultsInclude = {
  options: { orderBy: { sortOrder: 'asc' }, include: { _count: { select: { votes: true } } } },
  _count: { select: { votes: true } },
  author: { select: { fullName: true } },
} satisfies Prisma.PollInclude;

export type PollWithResults = Prisma.PollGetPayload<{ include: typeof pollWithResultsInclude }>;

export interface PollTally {
  optionId: string;
  label: string;
  votes: number;
  percent: number;
}

export function tallyPoll(poll: PollWithResults): { total: number; results: PollTally[] } {
  const total = poll._count.votes;
  return {
    total,
    results: poll.options.map((option) => ({
      optionId: option.id,
      label: option.label,
      votes: option._count.votes,
      percent: total > 0 ? Math.round((option._count.votes / total) * 100) : 0,
    })),
  };
}

/** True when the tally may be shown to a resident right now. */
export function pollResultsVisible(poll: { status: string; endsAt: Date; showLiveResults: boolean }): boolean {
  return poll.status === 'CLOSED' || poll.endsAt < new Date() || poll.showLiveResults;
}

/**
 * Casts a vote.
 *
 * "A resident must not be able to vote multiple times in the same poll" is
 * enforced by a unique constraint on (pollId, residentId) — the pre-check below
 * only exists to produce a friendlier message.
 */
export async function castVote(input: { pollId: string; optionId: string; residentId: string }) {
  const poll = await prisma.poll.findFirst({
    where: { id: input.pollId, deletedAt: null },
    select: { id: true, status: true, startsAt: true, endsAt: true, title: true },
  });

  if (!poll) throw new NotFoundError('That poll no longer exists.');

  const now = new Date();
  if (poll.status === 'DRAFT') throw new ConflictError('This poll has not opened yet.');
  if (poll.status === 'CLOSED' || poll.endsAt < now) throw new ConflictError('This poll has closed.');
  if (poll.startsAt > now) {
    throw new ConflictError(`Voting opens on ${poll.startsAt.toLocaleString('en-PK')}.`);
  }

  const option = await prisma.pollOption.findFirst({
    where: { id: input.optionId, pollId: poll.id },
    select: { id: true, label: true },
  });
  if (!option) throw new NotFoundError('That option is not part of this poll.');

  const existing = await prisma.pollVote.findUnique({
    where: { pollId_residentId: { pollId: poll.id, residentId: input.residentId } },
    select: { id: true },
  });
  if (existing) throw new ConflictError('You have already voted in this poll.');

  try {
    await prisma.pollVote.create({
      data: { pollId: poll.id, optionId: option.id, residentId: input.residentId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('You have already voted in this poll.');
    }
    throw error;
  }

  return { pollTitle: poll.title, optionLabel: option.label };
}

/** Closes polls whose end date has passed. */
export async function closeElapsedPolls(): Promise<number> {
  const result = await prisma.poll.updateMany({
    where: { status: 'ACTIVE', endsAt: { lt: new Date() } },
    data: { status: 'CLOSED' },
  });
  return result.count;
}

// ── Emergency alerts ──────────────────────────────────────────────────────────

export async function getActiveAlert() {
  return prisma.emergencyAlert.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
    include: { raisedBy: { select: { fullName: true } } },
  });
}

export async function resolveAlert(input: { alertId: string; resolverId: string; note?: string | null }) {
  const alert = await prisma.emergencyAlert.findUnique({
    where: { id: input.alertId },
    select: { id: true, status: true, title: true },
  });

  if (!alert) throw new NotFoundError('That alert no longer exists.');
  if (alert.status === 'RESOLVED') throw new ConflictError('This alert has already been resolved.');

  return prisma.emergencyAlert.update({
    where: { id: alert.id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedById: input.resolverId,
      resolutionNote: input.note ?? null,
    },
  });
}
