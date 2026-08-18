import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { ClipboardCheck, Star } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataPagination } from '@/components/shared/data-pagination';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { cn, formatDateTime, humanise } from '@/lib/utils';
import { slaState } from '@/services/complaint-service';

export const metadata: Metadata = { title: 'Completed Work' };

const PAGE_SIZE = 20;

export default async function StaffHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireRole('MAINTENANCE_STAFF', 'ADMIN');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const staffId =
    user.staffId ??
    (
      await prisma.staffProfile.findFirst({
        where: { deletedAt: null, user: { role: 'MAINTENANCE_STAFF' } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
    )?.id;

  if (!staffId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Completed work" />
        <EmptyState icon={ClipboardCheck} title="No staff profile linked to this account" />
      </div>
    );
  }

  const where: Prisma.ComplaintWhereInput = {
    assignedStaffId: staffId,
    status: { in: ['RESOLVED', 'CLOSED'] },
  };

  const [tickets, total, rated] = await Promise.all([
    prisma.complaint.findMany({
      where,
      orderBy: { resolvedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        flat: { include: { block: true } },
        resident: { include: { user: { select: { fullName: true } } } },
      },
    }),
    prisma.complaint.count({ where }),
    prisma.complaint.aggregate({
      where: { ...where, satisfaction: { not: null } },
      _avg: { satisfaction: true },
      _count: { _all: true },
    }),
  ]);

  const averageRating = rated._avg.satisfaction;
  const ratingCount = rated._count._all;

  const metSla = tickets.filter((ticket) => !slaState(ticket).overdue).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Record"
        title="Completed work"
        description="Tickets you have resolved or closed, most recent first."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Completed tickets" value={total} icon={ClipboardCheck} tone="success" />
        <StatCard
          label="Average rating"
          value={averageRating ? `${averageRating.toFixed(1)} / 5` : '—'}
          hint={`${ratingCount} resident rating(s)`}
          icon={Star}
          tone="info"
        />
        <StatCard
          label="Met SLA (this page)"
          value={`${metSla}/${tickets.length}`}
          hint="Resolved within the target window"
        />
      </section>

      {tickets.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No completed tickets yet"
          description="Tickets you resolve will be listed here with their outcome and rating."
        />
      ) : (
        <>
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const sla = slaState(ticket);
              return (
                <Card key={ticket.id} className="transition-shadow hover:border-primary/40">
                  <Link href={`/staff/tickets/${ticket.id}`} className="block">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{ticket.title}</h3>
                            <StatusBadge status={ticket.status} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {ticket.ticketNumber} · {humanise(ticket.category)} · Flat{' '}
                            {ticket.flat.block.name}-{ticket.flat.flatNumber} ·{' '}
                            {ticket.resident.user.fullName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Resolved {formatDateTime(ticket.resolvedAt)} · {sla.label}
                          </p>
                        </div>

                        {ticket.satisfaction ? (
                          <span
                            className="flex items-center gap-0.5"
                            aria-label={`Rated ${ticket.satisfaction} out of 5`}
                          >
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={index}
                                className={cn(
                                  'size-4',
                                  index < ticket.satisfaction!
                                    ? 'fill-warning text-warning'
                                    : 'text-muted-foreground/40',
                                )}
                                aria-hidden
                              />
                            ))}
                          </span>
                        ) : null}
                      </div>

                      {ticket.resolutionNotes ? (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {ticket.resolutionNotes}
                        </p>
                      ) : null}
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>

          <DataPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  );
}
