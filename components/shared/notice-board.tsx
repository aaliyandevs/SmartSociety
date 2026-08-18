import Link from 'next/link';
import { CalendarDays, Megaphone, MapPin, Pin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate, formatRelative, humanise, truncate } from '@/lib/utils';

export interface NoticeSummary {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  publishAt: Date;
  expiresAt: Date | null;
  eventDate: Date | null;
  eventLocation: string | null;
  isPinned: boolean;
  author?: { fullName: string } | null;
}

/** Notice board list shared by residents and staff. */
export function NoticeBoard({
  notices,
  basePath,
}: {
  notices: NoticeSummary[];
  /** e.g. "/resident/notices" — omit to render non-clickable cards. */
  basePath?: string;
}) {
  if (notices.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No notices right now"
        description="Announcements published by the society office will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {notices.map((notice) => {
        const body = (
          <CardContent className="space-y-2 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {notice.isPinned ? (
                <Badge variant="soft">
                  <Pin className="size-3" />
                  Pinned
                </Badge>
              ) : null}
              <Badge variant="outline">{humanise(notice.category)}</Badge>
              {notice.priority === 'HIGH' || notice.priority === 'URGENT' ? (
                <StatusBadge status={notice.priority} />
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {formatRelative(notice.publishAt)}
              </span>
            </div>

            <h3 className="font-semibold leading-snug">{notice.title}</h3>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {truncate(notice.content.replace(/\n+/g, ' '), 220)}
            </p>

            {notice.eventDate || notice.eventLocation ? (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                {notice.eventDate ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" aria-hidden />
                    {formatDate(notice.eventDate)}
                  </span>
                ) : null}
                {notice.eventLocation ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" aria-hidden />
                    {notice.eventLocation}
                  </span>
                ) : null}
              </div>
            ) : null}

            {notice.author ? (
              <p className="pt-1 text-xs text-muted-foreground">Posted by {notice.author.fullName}</p>
            ) : null}
          </CardContent>
        );

        return basePath ? (
          <Card key={notice.id} className="transition-shadow hover:border-primary/40 hover:shadow-md">
            <Link href={`${basePath}/${notice.id}`} className="block">
              {body}
            </Link>
          </Card>
        ) : (
          <Card key={notice.id}>{body}</Card>
        );
      })}
    </div>
  );
}
