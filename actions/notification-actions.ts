'use server';

import { revalidatePath } from 'next/cache';

import { type ActionState, runAction, success } from '@/lib/action-result';
import { requireUser } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';

export async function markNotificationReadAction(notificationId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireUser();

    // Scoped by userId so one resident can never touch another's notifications.
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      const exists = await prisma.notification.findFirst({
        where: { id: notificationId, userId: user.id },
        select: { id: true },
      });
      if (!exists) throw new NotFoundError('That notification no longer exists.');
    }

    revalidatePath('/account/notifications');
    return success('Marked as read.');
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireUser();

    const result = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    revalidatePath('/account/notifications');
    return success(
      result.count === 0
        ? 'You are all caught up.'
        : `Marked ${result.count} notification${result.count === 1 ? '' : 's'} as read.`,
    );
  });
}

export async function markNoticeReadAction(noticeId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireUser();

    await prisma.noticeRead.upsert({
      where: { noticeId_userId: { noticeId, userId: user.id } },
      create: { noticeId, userId: user.id },
      update: {},
    });

    return success('Notice marked as read.');
  });
}
