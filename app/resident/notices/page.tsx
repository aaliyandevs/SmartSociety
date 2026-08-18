import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { CalendarDays } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { NoticeBoard } from '@/components/shared/notice-board';
import { FilterBar } from '@/components/shared/filter-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import { visibleNoticeWhere } from '@/services/community-service';

export const metadata: Metadata = { title: 'Notice Board' };

export default async function ResidentNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const user = await requireResident();
  const params = await searchParams;

  const resident = await prisma.residentProfile.findUnique({
    where: { id: user.residentId },
    select: { residentType: true },
  });

  const baseWhere = visibleNoticeWhere('RESIDENT', resident?.residentType);

  const [notices, events] = await Promise.all([
    prisma.notice.findMany({
      where: {
        ...baseWhere,
        ...(params.category
          ? { category: params.category as Prisma.EnumNoticeCategoryFilter['equals'] }
          : {}),
        ...(params.q
          ? {
              OR: [
                { title: { contains: params.q, mode: 'insensitive' } },
                { content: { contains: params.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
      take: 50,
      include: { author: { select: { fullName: true } } },
    }),
    prisma.notice.findMany({
      where: { ...baseWhere, eventDate: { gte: new Date() } },
      orderBy: { eventDate: 'asc' },
      take: 5,
      select: { id: true, title: true, eventDate: true, eventLocation: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Notice board"
        description="Announcements, event calendar and society updates from the managing committee."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <FilterBar
            searchPlaceholder="Search notices…"
            filters={[
              {
                name: 'category',
                label: 'Category',
                options: [
                  { value: 'GENERAL', label: 'General' },
                  { value: 'MAINTENANCE', label: 'Maintenance' },
                  { value: 'EVENT', label: 'Event' },
                  { value: 'FINANCIAL', label: 'Financial' },
                  { value: 'SECURITY', label: 'Security' },
                  { value: 'GUIDELINE', label: 'Guideline' },
                  { value: 'EMERGENCY', label: 'Emergency' },
                ],
              },
            ]}
          />
          <NoticeBoard notices={notices} basePath="/resident/notices" />
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
              Upcoming events
            </CardTitle>
            <CardDescription>Society gatherings and scheduled work.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Nothing scheduled right now.</p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {events.map((event) => (
                  <li key={event.id} className="px-5 py-3.5">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(event.eventDate)}
                      {event.eventLocation ? ` · ${event.eventLocation}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
