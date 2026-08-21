import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { CheckCircle2, Clock, LifeBuoy, TriangleAlert } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatRelative, humanise, pluralize } from '@/lib/utils';
import { getComplaintStats, slaState } from '@/services/complaint-service';

export const metadata: Metadata = { title: 'Complaints' };

const PAGE_SIZE = 15;

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    priority?: string;
    assigned?: string;
    page?: string;
  }>;
}) {
  await requireRole('ADMIN');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.ComplaintWhereInput = {
    deletedAt: null,
    ...(params.status ? { status: params.status as Prisma.EnumComplaintStatusFilter['equals'] } : {}),
    ...(params.category
      ? { category: params.category as Prisma.EnumComplaintCategoryFilter['equals'] }
      : {}),
    ...(params.priority
      ? { priority: params.priority as Prisma.EnumComplaintPriorityFilter['equals'] }
      : {}),
    ...(params.assigned === 'UNASSIGNED' ? { assignedStaffId: null } : {}),
    ...(params.assigned && params.assigned !== 'UNASSIGNED' ? { assignedStaffId: params.assigned } : {}),
    ...(params.q
      ? {
          OR: [
            { ticketNumber: { contains: params.q, mode: 'insensitive' } },
            { title: { contains: params.q, mode: 'insensitive' } },
            { flat: { flatNumber: { contains: params.q, mode: 'insensitive' } } },
            { resident: { user: { fullName: { contains: params.q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const [complaints, total, stats, staff] = await Promise.all([
    prisma.complaint.findMany({
      where,
      orderBy: [{ status: 'asc' }, { slaDueAt: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        flat: { include: { block: true } },
        resident: { include: { user: { select: { fullName: true } } } },
        assignedStaff: { include: { user: { select: { fullName: true } } } },
        _count: { select: { attachments: true, updates: true } },
      },
    }),
    prisma.complaint.count({ where }),
    getComplaintStats(),
    prisma.staffProfile.findMany({
      where: { deletedAt: null, user: { role: 'MAINTENANCE_STAFF' } },
      include: { user: { select: { fullName: true } } },
      orderBy: { user: { fullName: 'asc' } },
    }),
  ]);

  const unassigned = await prisma.complaint.count({
    where: { deletedAt: null, assignedStaffId: null, status: { in: ['PENDING', 'IN_PROGRESS'] } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Helpdesk"
        title="Complaints"
        description="Route resident tickets to maintenance staff and monitor resolution against the SLA."
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open tickets"
          value={stats.open}
          hint={`${stats.counts.PENDING} pending · ${stats.counts.IN_PROGRESS} in progress`}
          icon={LifeBuoy}
          tone={stats.open > 0 ? 'info' : 'default'}
        />
        <StatCard
          label="SLA breached"
          value={stats.slaBreached}
          icon={TriangleAlert}
          tone={stats.slaBreached > 0 ? 'destructive' : 'success'}
        />
        <StatCard
          label="Awaiting assignment"
          value={unassigned}
          icon={Clock}
          tone={unassigned > 0 ? 'warning' : 'default'}
          href="/admin/complaints?assigned=UNASSIGNED"
        />
        <StatCard
          label="Average resolution"
          value={stats.averageResolutionHours > 0 ? `${stats.averageResolutionHours} h` : '—'}
          hint={`${stats.counts.RESOLVED + stats.counts.CLOSED} tickets completed`}
          icon={CheckCircle2}
          tone="success"
        />
      </section>

      {unassigned > 0 ? (
        <Alert
          variant="warning"
          title={`${pluralize(unassigned, 'open ticket')} ${unassigned === 1 ? 'has' : 'have'} no technician assigned`}
        >
          Open a ticket to route it — the assignment panel recommends the technician whose department
          matches the complaint category and who has the lightest workload.
        </Alert>
      ) : null}

      <FilterBar
        searchPlaceholder="Search ticket, title, flat or resident…"
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
          {
            name: 'assigned',
            label: 'Assignee',
            options: [
              { value: 'UNASSIGNED', label: 'Unassigned' },
              ...staff.map((member) => ({ value: member.id, label: member.user.fullName })),
            ],
          },
        ]}
      />

      {complaints.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No tickets match these filters"
          description="Clear the filters to see the full helpdesk queue."
        />
      ) : (
        <>
          <div className="space-y-3">
            {complaints.map((complaint) => {
              const sla = slaState(complaint);
              return (
                <Card key={complaint.id} className="transition-shadow hover:border-primary/40 hover:shadow-md">
                  <Link href={`/admin/complaints/${complaint.id}`} className="block">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{complaint.title}</h3>
                            <StatusBadge status={complaint.status} />
                            <StatusBadge status={complaint.priority} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {complaint.ticketNumber} · {humanise(complaint.category)} · Flat{' '}
                            {complaint.flat.block.name}-{complaint.flat.flatNumber} ·{' '}
                            {complaint.resident.user.fullName}
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
                          <Badge variant="warning">Unassigned</Badge>
                        )}
                        <span>Raised {formatRelative(complaint.createdAt)}</span>
                        <span>Due {formatRelative(complaint.slaDueAt)}</span>
                        {complaint._count.attachments > 0 ? (
                          <span>{complaint._count.attachments} photo(s)</span>
                        ) : null}
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
