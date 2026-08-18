import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Lightweight polling endpoint for the notification bell and the live emergency
 * banner. Returns only what the header needs — never the full notification body
 * list — so the request stays small enough to poll on a gate tablet.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [unreadCount, notifications, activeAlert] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        link: true,
        isUrgent: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.emergencyAlert.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        message: true,
        instructions: true,
        sirenEnabled: true,
        startedAt: true,
      },
    }),
  ]);

  return NextResponse.json(
    { unreadCount, notifications, activeAlert },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
