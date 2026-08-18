import 'server-only';

import type { NotificationType, Prisma, Role } from '@prisma/client';

import prisma from '@/lib/prisma';

/**
 * In-app notification fan-out.
 *
 * Delivery is best-effort and never blocks the originating transaction: a
 * resident's complaint must be saved even if the notification insert fails.
 */

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  isUrgent?: boolean;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        isUrgent: input.isUrgent ?? false,
      },
    });
  } catch (error) {
    console.error('[notifications] failed to create notification', error);
  }
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const data: Prisma.NotificationCreateManyInput[] = inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      isUrgent: input.isUrgent ?? false,
    }));
    await prisma.notification.createMany({ data });
  } catch (error) {
    console.error('[notifications] failed to create notifications', error);
  }
}

/** Broadcast to every active user holding one of the given roles. */
export async function notifyRoles(
  roles: Role[],
  payload: Omit<NotifyInput, 'userId'>,
): Promise<number> {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  await notifyMany(users.map((user) => ({ ...payload, userId: user.id })));
  return users.length;
}

/** Notify every resident linked to a flat (owner + tenants sharing the unit). */
export async function notifyFlat(
  flatId: string,
  payload: Omit<NotifyInput, 'userId'>,
): Promise<number> {
  const residents = await prisma.residentProfile.findMany({
    where: { flatId, deletedAt: null, user: { status: 'ACTIVE', deletedAt: null } },
    select: { userId: true },
  });
  await notifyMany(residents.map((resident) => ({ ...payload, userId: resident.userId })));
  return residents.length;
}
