import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDate, formatDateTime, humanise } from '@/lib/utils';
import { visibleNoticeWhere } from '@/services/community-service';
import { markNoticeReadAction } from '@/actions/notification-actions';

export const metadata: Metadata = { title: 'Notice' };

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResident();

  const resident = await prisma.residentProfile.findUnique({
    where: { id: user.residentId },
    select: { residentType: true },
  });

  const notice = await prisma.notice.findFirst({
    where: { id, ...visibleNoticeWhere('RESIDENT', resident?.residentType) },
    include: { author: { select: { fullName: true } } },
  });

  if (!notice) notFound();

  // Best-effort read receipt; failures never block the page.
  await markNoticeReadAction(notice.id).catch(() => undefined);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/resident/notices">
          <ArrowLeft className="size-4" />
          Back to the notice board
        </Link>
      </Button>

      <PageHeader
        eyebrow={humanise(notice.category)}
        title={notice.title}
        description={`Published ${formatDateTime(notice.publishAt)}${notice.author ? ` by ${notice.author.fullName}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {notice.isPinned ? <Badge variant="soft">Pinned</Badge> : null}
            <StatusBadge status={notice.priority} />
          </div>
        }
      />

      {notice.priority === 'URGENT' ? (
        <Alert variant="destructive" title="Urgent notice">
          Please read this carefully and act on it promptly.
        </Alert>
      ) : null}

      {notice.eventDate || notice.eventLocation ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center gap-6 p-5">
            {notice.eventDate ? (
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <CalendarDays className="size-4.5" aria-hidden />
                </span>
                <span>
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">Date</span>
                  <span className="block text-sm font-medium">{formatDate(notice.eventDate)}</span>
                </span>
              </div>
            ) : null}
            {notice.eventLocation ? (
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <MapPin className="size-4.5" aria-hidden />
                </span>
                <span>
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">Venue</span>
                  <span className="block text-sm font-medium">{notice.eventLocation}</span>
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <div className="prose-sm max-w-none whitespace-pre-line text-sm leading-relaxed">
            {notice.content}
          </div>
          {notice.expiresAt ? (
            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
              This notice stays on the board until {formatDate(notice.expiresAt)}.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
