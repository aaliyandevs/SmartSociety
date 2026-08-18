import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { LifeBuoy, Plus } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatRelative, humanise } from '@/lib/utils';
import { getComplaintStats, slaState } from '@/services/complaint-service';

export const metadata: Metadata = { title: 'Complaints' };

const PAGE_SIZE = 12;

export default async function ResidentComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; page?: string }>;
}) {
  const user = await requireResident();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.ComplaintWhereInput = {
    residentId: user.residentId,
    deletedAt: null,
    ...(params.status ? { status: params.status as Prisma.EnumComplaintStatusFilter['equals'] } : {}),
    ...(params.category
      ? { category: params.category as Prisma.EnumComplaintCategoryFilter['equals'] }
      : {}),
    ...(params.q
      ? {
          OR: [
            { ticketNumber: { contains: params.q, mode: 'insensitive' } },
            { title: { contains: params.q, mode: 'insensitive' } },
            { description: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [complaints, total, stats] = await Promise.all([
    prisma.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        assignedStaff: { include: { user: { select: { fullName: true } } } },
        _count: { select: { attachments: true, updates: true } },
      },
    }),
    prisma.complaint.count({ where }),
    getComplaintStats({ residentId: user.residentId }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Helpdesk"
        title="My complaints"
        description="Raise a maintenance ticket and follow it through to resolution."
        actions={
          <Button asChild>
            <Link href="/resident/complaints/new">
              <Plus className="size-4" />
              Raise a ticket
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open" value={stats.open} tone={stats.open > 0 ? 'info' : 'default'} />
        <StatCard label="Resolved" value={stats.counts.RESOLVED} tone="success" />
        <StatCard label="Closed" value={stats.counts.CLOSED} />
        <StatCard
          label="Average resolution"
          value={stats.averageResolutionHours > 0 ? `${stats.averageResolutionHours} h` : '—'}
          hint="Across your resolved tickets"
        />
      </section>

      <FilterBar
        searchPlaceholder="Search your tickets…"
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
            name: 'category',
            label: 'Category',
            options: [
              { value: 'PLUMBING', label: 'Plumbing' },
              { value: 'ELECTRICAL', label: 'Electrical' },
              { value: 'ELEVATOR', label: 'Elevator' },
              { value: 'CLEANING', label: 'Cleaning' },
              { value: 'SECURITY', label: 'Security' },
              { value: 'WATER', label: 'Water' },
              { value: 'CARPENTRY', label: 'Carpentry' },
              { value: 'PEST_CONTROL', label: 'Pest control' },
              { value: 'OTHER', label: 'Other' },
            ],
          },
        ]}
      />

      {complaints.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={total === 0 ? 'No tickets raised yet' : 'No tickets match these filters'}
          description={
            total === 0
              ? 'If something in your flat or the common areas needs attention, raise a ticket and the society will route it to the right technician.'
              : 'Clear the filters to see all of your tickets.'
          }
          action={
            total === 0 ? (
              <Button asChild>
                <Link href="/resident/complaints/new">Raise your first ticket</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {complaints.map((complaint) => {
              const sla = slaState(complaint);
              return (
                <Card key={complaint.id} className="transition-shadow hover:border-primary/40 hover:shadow-md">
                  <Link href={`/resident/complaints/${complaint.id}`} className="block">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{complaint.title}</h3>
                            <StatusBadge status={complaint.status} />
                            <StatusBadge status={complaint.priority} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {complaint.ticketNumber} · {humanise(complaint.category)}
                            {complaint.location ? ` · ${complaint.location}` : ''} ·{' '}
                            {formatRelative(complaint.createdAt)}
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
                        {complaint.description}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {complaint.assignedStaff ? (
                          <span>Assigned to {complaint.assignedStaff.user.fullName}</span>
                        ) : (
                          <span>Awaiting assignment</span>
                        )}
                        {complaint._count.attachments > 0 ? (
                          <span>{complaint._count.attachments} photo(s)</span>
                        ) : null}
                        <span>{complaint._count.updates} update(s)</span>
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
