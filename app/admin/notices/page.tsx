import type { Metadata } from 'next';
import { Eye, EyeOff, Megaphone, Pin } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { NoticeEditor, DeleteNoticeButton } from '@/app/admin/notices/notice-editor';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDate, formatDateTime, humanise, toDateTimeInputValue, truncate } from '@/lib/utils';
import type { Prisma } from '@prisma/client';

export const metadata: Metadata = { title: 'Notices' };

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; state?: string }>;
}) {
  await requireRole('ADMIN');
  const params = await searchParams;
  const now = new Date();

  const where: Prisma.NoticeWhereInput = {
    deletedAt: null,
    ...(params.category
      ? { category: params.category as Prisma.EnumNoticeCategoryFilter['equals'] }
      : {}),
    ...(params.state === 'PUBLISHED' ? { isPublished: true, publishAt: { lte: now } } : {}),
    ...(params.state === 'SCHEDULED' ? { isPublished: true, publishAt: { gt: now } } : {}),
    ...(params.state === 'DRAFT' ? { isPublished: false } : {}),
    ...(params.state === 'EXPIRED' ? { expiresAt: { lt: now } } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: 'insensitive' } },
            { content: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [notices, published, scheduled, pinned] = await Promise.all([
    prisma.notice.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
      take: 60,
      include: {
        author: { select: { fullName: true } },
        _count: { select: { reads: true } },
      },
    }),
    prisma.notice.count({ where: { deletedAt: null, isPublished: true, publishAt: { lte: now } } }),
    prisma.notice.count({ where: { deletedAt: null, isPublished: true, publishAt: { gt: now } } }),
    prisma.notice.count({ where: { deletedAt: null, isPinned: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title="Notice board"
        description="Publish announcements, event details and rule updates to residents and staff."
        actions={<NoticeEditor />}
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live notices" value={published} icon={Megaphone} tone="success" />
        <StatCard label="Scheduled" value={scheduled} icon={Eye} tone="info" />
        <StatCard label="Pinned" value={pinned} icon={Pin} />
        <StatCard label="Total on record" value={notices.length} icon={EyeOff} />
      </section>

      <FilterBar
        searchPlaceholder="Search notices…"
        filters={[
          {
            name: 'state',
            label: 'State',
            options: [
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'SCHEDULED', label: 'Scheduled' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'EXPIRED', label: 'Expired' },
            ],
          },
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

      {notices.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No notices match these filters"
          description="Clear the filters, or publish a new announcement."
        />
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => {
            const isLive = notice.isPublished && notice.publishAt <= now;
            const isExpired = notice.expiresAt !== null && notice.expiresAt < now;

            return (
              <Card key={notice.id}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{notice.title}</h3>
                        {notice.isPinned ? (
                          <Badge variant="soft">
                            <Pin className="size-3" />
                            Pinned
                          </Badge>
                        ) : null}
                        <Badge variant="outline">{humanise(notice.category)}</Badge>
                        <StatusBadge status={notice.priority} />
                        <Badge variant={isExpired ? 'muted' : isLive ? 'success' : 'warning'}>
                          {isExpired ? 'Expired' : isLive ? 'Live' : notice.isPublished ? 'Scheduled' : 'Draft'}
                        </Badge>
                      </div>

                      <p className="mt-2 text-sm text-muted-foreground">
                        {truncate(notice.content.replace(/\n+/g, ' '), 180)}
                      </p>

                      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Published {formatDateTime(notice.publishAt)}</span>
                        {notice.expiresAt ? <span>Expires {formatDate(notice.expiresAt)}</span> : null}
                        {notice.eventDate ? <span>Event {formatDate(notice.eventDate)}</span> : null}
                        <span>Audience: {humanise(notice.audience)}</span>
                        <span>{notice._count.reads} read(s)</span>
                        {notice.author ? <span>by {notice.author.fullName}</span> : null}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <NoticeEditor
                        notice={{
                          id: notice.id,
                          title: notice.title,
                          content: notice.content,
                          category: notice.category,
                          priority: notice.priority,
                          audience: notice.audience,
                          publishAt: toDateTimeInputValue(notice.publishAt),
                          expiresAt: notice.expiresAt ? toDateTimeInputValue(notice.expiresAt) : '',
                          eventDate: notice.eventDate ? toDateTimeInputValue(notice.eventDate) : '',
                          eventLocation: notice.eventLocation,
                          isPinned: notice.isPinned,
                          isPublished: notice.isPublished,
                        }}
                      />
                      <DeleteNoticeButton noticeId={notice.id} title={notice.title} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
