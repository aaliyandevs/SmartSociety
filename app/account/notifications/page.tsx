import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { NotificationList } from '@/app/account/notifications/notification-list';
import { requireUser } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const user = await requireUser();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Notifications"
        description="Bills, visitors, tickets, bookings and society announcements sent to you."
      />

      <NotificationList
        unreadCount={unreadCount}
        notifications={notifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          link: notification.link,
          isUrgent: notification.isUrgent,
          readAt: notification.readAt ? notification.readAt.toISOString() : null,
          createdAt: notification.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
