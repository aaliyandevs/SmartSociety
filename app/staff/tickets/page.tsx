import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { CheckCircle2, ListChecks } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatRelative, humanise } from '@/lib/utils';
import { slaState } from '@/services/complaint-service';

export const metadata: Metadata = { title: 'Assigned Tickets' };

const PAGE_SIZE = 20;

export default async function StaffTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; page?: string }>;
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
        <PageHeader title="Assigned tickets" />
        <EmptyState icon={ListChecks} title="No staff profile linked to this account" />
      </div>
    );
  }

  const where: Prisma.ComplaintWhereInput = {
    assignedStaffId: staffId,
    deletedAt: null,
    ...(params.status
      ? { status: params.status as Prisma.EnumComplaintStatusFilter['equals'] }
      : { status: { in: ['PENDING', 'IN_PROGRESS'] } }),
    ...(params.priority
      ? { priority: params.priority as Prisma.EnumComplaintPriorityFilter['equals'] }
      : {}),
    ...(params.q
      ? {
          OR: [
            { ticketNumber: { contains: params.q, mode: 'insensitive' } },
            { title: { contains: params.q, mode: 'insensitive' } },
            { flat: { flatNumber: { contains: params.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [tickets, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      orderBy: [{ slaDueAt: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        flat: { include: { block: true } },
        resident: { include: { user: { select: { fullName: true, phone: true } } } },
        _count: { select: { attachments: true, updates: true } },
      },
    }),
    prisma.complaint.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Helpdesk"
        title="Assigned tickets"
        description="Tickets routed to you, ordered by service-level deadline."
      />

      <FilterBar
        searchPlaceholder="Search ticket number, title or flat…"
        filters={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'PENDING', label: 'Pending' },
              { value: 'IN_PROGRESS', label: 'In progress' },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: 'CLOSED', label: 'Closed' },
            ],
          },
          {
            name: 'priority',
            label: 'Priority',
            options: [
              { value: 'CRITICAL', label: 'Critical' },
              { value: 'HIGH', label: 'High' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'LOW', label: 'Low' },
            ],
          },
        ]}
      />

      {tickets.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing in your queue"
          description="No ticket matches these filters. Newly assigned work will appear here."
        />
      ) : (
        <>
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const sla = slaState(ticket);
              return (
                <Card key={ticket.id} className="transition-shadow hover:border-primary/40 hover:shadow-md">
                  <Link href={`/staff/tickets/${ticket.id}`} className="block">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{ticket.title}</h3>
                            <StatusBadge status={ticket.status} />
                            <StatusBadge status={ticket.priority} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {ticket.ticketNumber} · {humanise(ticket.category)} · Flat{' '}
                            {ticket.flat.block.name}-{ticket.flat.flatNumber}
                            {ticket.location ? ` · ${ticket.location}` : ''}
                          </p>
                        </div>
                        <Badge
                          variant={
                            sla.tone === 'destructive'
                              ? 'destructive'
                              : sla.tone === 'warning'
                                ? 'warning'
                                : sla.tone === 'success'
                                  ? 'success'
                                  : 'muted'
                          }
                        >
                          {sla.label}
                        </Badge>
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {ticket.description}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Raised by {ticket.resident.user.fullName}</span>
                        <span>Due {formatRelative(ticket.slaDueAt)}</span>
                        {ticket._count.attachments > 0 ? (
                          <span>{ticket._count.attachments} photo(s)</span>
                        ) : null}
                        <span>{ticket._count.updates} update(s)</span>
                      </div>
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
