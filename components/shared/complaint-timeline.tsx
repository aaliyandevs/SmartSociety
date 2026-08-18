import { CircleDot } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { ROLE_LABELS } from '@/lib/rbac';
import { formatDateTime, humanise } from '@/lib/utils';
import type { Role } from '@prisma/client';

export interface TimelineEntry {
  id: string;
  note: string;
  fromStatus: string | null;
  toStatus: string | null;
  isInternal: boolean;
  createdAt: Date;
  author: { fullName: string; role: Role } | null;
}

/**
 * Status history for a helpdesk ticket.
 *
 * `showInternal` is false on the resident's view: notes a technician marks as
 * internal stay within the maintenance team.
 */
export function ComplaintTimeline({
  updates,
  showInternal = false,
}: {
  updates: TimelineEntry[];
  showInternal?: boolean;
}) {
  const visible = showInternal ? updates : updates.filter((update) => !update.isInternal);

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No updates recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-6 border-l border-border pl-6">
      {visible.map((update) => (
        <li key={update.id} className="relative">
          <span
            className="absolute -left-[1.9rem] top-0.5 flex size-4 items-center justify-center rounded-full bg-background text-primary"
            aria-hidden
          >
            <CircleDot className="size-4" />
          </span>

          <div className="flex flex-wrap items-center gap-2">
            {update.toStatus && update.fromStatus !== update.toStatus ? (
              <>
                {update.fromStatus ? (
                  <>
                    <StatusBadge status={update.fromStatus} />
                    <span className="text-xs text-muted-foreground" aria-hidden>
                      →
                    </span>
                  </>
                ) : null}
                <StatusBadge status={update.toStatus} />
              </>
            ) : (
              <Badge variant="muted">Note</Badge>
            )}
            {update.isInternal ? <Badge variant="warning">Internal</Badge> : null}
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDateTime(update.createdAt)}
            </span>
          </div>

          <p className="mt-1.5 whitespace-pre-line text-sm">{update.note}</p>

          {update.author ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {update.author.fullName} · {ROLE_LABELS[update.author.role] ?? humanise(update.author.role)}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
