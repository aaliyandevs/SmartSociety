import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { IdCard, QrCode, Ticket, Users } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDateTime, formatRelative, humanise } from '@/lib/utils';
import { expireStalePasses } from '@/services/gate-service';

export const metadata: Metadata = { title: 'Visitors' };

const PAGE_SIZE = 20;

export default async function AdminVisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  await requireRole('ADMIN');
  await expireStalePasses();

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.GatePassWhereInput = {
    ...(params.status ? { status: params.status as Prisma.EnumGatePassStatusFilter['equals'] } : {}),
    ...(params.type ? { visitorType: params.type as Prisma.EnumVisitorTypeFilter['equals'] } : {}),
    ...(params.q
      ? {
          OR: [
            { passCode: { contains: params.q, mode: 'insensitive' } },
            { gateCode: { contains: params.q } },
            { visitor: { name: { contains: params.q, mode: 'insensitive' } } },
            { visitor: { phone: { contains: params.q } } },
            { flat: { flatNumber: { contains: params.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [passes, total, activeCount, visitorsToday, insideNow, byType] = await Promise.all([
    prisma.gatePass.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        visitor: true,
        flat: { include: { block: true } },
        resident: { include: { user: { select: { fullName: true } } } },
        _count: { select: { gateLogs: true } },
      },
    }),
    prisma.gatePass.count({ where }),
    prisma.gatePass.count({ where: { status: 'ACTIVE', validUntil: { gt: now } } }),
    prisma.gateLog.count({ where: { entryAt: { gte: todayStart } } }),
    prisma.gateLog.count({ where: { status: 'INSIDE' } }),
    prisma.visitor.groupBy({
      by: ['visitorType'],
      _count: { _all: true },
      where: { createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
    }),
  ]);

  const topType = byType.sort((a, b) => b._count._all - a._count._all)[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Visitors & gate passes"
        description="Every visitor pre-approved by a resident, with the pass status and gate usage."
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active passes" value={activeCount} icon={Ticket} tone="success" />
        <StatCard label="Visitors today" value={visitorsToday} icon={IdCard} tone="info" />
        <StatCard
          label="Inside now"
          value={insideNow}
          icon={Users}
          href="/admin/security?status=INSIDE"
        />
        <StatCard
          label="Most common type"
          value={topType ? humanise(topType.visitorType) : '—'}
          hint="Last 30 days"
          icon={QrCode}
        />
      </section>

      <FilterBar
        searchPlaceholder="Search pass code, visitor, phone or flat…"
        filters={[
          {
            name: 'status',
            label: 'Pass status',
            options: [
              { value: 'ACTIVE', label: 'Active' },
              { value: 'USED', label: 'Used' },
              { value: 'EXPIRED', label: 'Expired' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'REJECTED', label: 'Rejected' },
            ],
          },
          {
            name: 'type',
            label: 'Visitor type',
            options: [
              { value: 'GUEST', label: 'Guest' },
              { value: 'DELIVERY', label: 'Delivery' },
              { value: 'CAB', label: 'Cab' },
              { value: 'VENDOR', label: 'Vendor' },
              { value: 'SERVICE', label: 'Service' },
              { value: 'OTHER', label: 'Other' },
            ],
          },
        ]}
      />

      {passes.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No gate passes match these filters"
          description="Clear the filters to see every pass issued by residents."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Flat / host</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Gate code</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passes.map((pass) => (
                  <TableRow key={pass.id}>
                    <TableCell>
                      <p className="font-medium">{pass.visitor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pass.visitor.phone}
                        {pass.visitor.company ? ` · ${pass.visitor.company}` : ''}
                      </p>
                      {pass.visitor.vehicleNumber ? (
                        <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                          {pass.visitor.vehicleNumber}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{humanise(pass.visitorType)}</TableCell>
                    <TableCell>
                      <p className="whitespace-nowrap font-medium">
                        {pass.flat.block.name}-{pass.flat.flatNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">{pass.resident.user.fullName}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <p>{formatDateTime(pass.validFrom)}</p>
                      <p className="text-muted-foreground">to {formatDateTime(pass.validUntil)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted" className="font-mono">
                        {pass.gateCode}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-sm">
                      {pass.entriesUsed}/{pass.maxEntries}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={pass.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {passes.map((pass) => (
              <Card key={pass.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{pass.visitor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {humanise(pass.visitorType)} → Flat {pass.flat.block.name}-{pass.flat.flatNumber}
                      </p>
                    </div>
                    <StatusBadge status={pass.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Valid until {formatDateTime(pass.validUntil)} ({formatRelative(pass.validUntil)})
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted" className="font-mono">
                      {pass.gateCode}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {pass.entriesUsed}/{pass.maxEntries} entries
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DataPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  );
}
