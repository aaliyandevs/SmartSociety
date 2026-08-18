import type { Metadata } from 'next';
import {
  BadgeIndianRupee,
  Building2,
  CalendarRange,
  Gauge,
  LifeBuoy,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { CollectionTrendChart, ComplaintCategoryChart } from '@/components/charts/dashboard-charts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
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
import { MONTH_NAMES, formatCurrency, humanise } from '@/lib/utils';
import { getCollectionSummary, getMonthlyCollectionTrend } from '@/services/billing-service';
import { getComplaintStats } from '@/services/complaint-service';

export const metadata: Metadata = { title: 'Reports' };

export default async function AdminReportsPage() {
  await requireRole('ADMIN');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date(now.getTime() - 30 * 86_400_000);

  const [
    collection,
    trend,
    complaints,
    blockCollection,
    amenityUsage,
    gateSummary,
    staffPerformance,
    occupancy,
    residentCount,
  ] = await Promise.all([
    getCollectionSummary(),
    getMonthlyCollectionTrend(6),
    getComplaintStats(),
    prisma.block.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        flats: {
          where: { deletedAt: null },
          select: {
            bills: {
              where: { status: { not: 'CANCELLED' } },
              select: { totalAmount: true, paidAmount: true },
            },
          },
        },
      },
    }),
    prisma.amenityBooking.groupBy({
      by: ['amenityId'],
      where: { createdAt: { gte: last30 }, status: { not: 'CANCELLED' } },
      _count: { _all: true },
      _sum: { fee: true },
    }),
    prisma.gateLog.groupBy({
      by: ['verificationMethod'],
      where: { createdAt: { gte: last30 } },
      _count: { _all: true },
    }),
    prisma.staffProfile.findMany({
      where: { deletedAt: null, user: { role: 'MAINTENANCE_STAFF' } },
      include: {
        user: { select: { fullName: true } },
        _count: {
          select: {
            assignedComplaints: true,
          },
        },
      },
    }),
    prisma.flat.groupBy({
      by: ['occupancyStatus'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.residentProfile.count({ where: { deletedAt: null } }),
  ]);

  const amenities = await prisma.amenity.findMany({
    where: { id: { in: amenityUsage.map((row) => row.amenityId) } },
    select: { id: true, name: true },
  });
  const amenityNames = new Map(amenities.map((amenity) => [amenity.id, amenity.name]));

  // Resolution stats per technician, computed from their completed tickets.
  const resolutionByStaff = await prisma.complaint.groupBy({
    by: ['assignedStaffId'],
    where: { assignedStaffId: { not: null }, resolvedAt: { not: null } },
    _count: { _all: true },
    _avg: { satisfaction: true },
  });
  const resolvedMap = new Map(
    resolutionByStaff.map((row) => [
      row.assignedStaffId,
      { resolved: row._count._all, rating: row._avg.satisfaction },
    ]),
  );

  const occupied = occupancy.find((row) => row.occupancyStatus === 'OCCUPIED')?._count._all ?? 0;
  const totalFlats = occupancy.reduce((sum, row) => sum + row._count._all, 0);
  const gateTotal = gateSummary.reduce((sum, row) => sum + row._count._all, 0);

  const monthLabel = `${MONTH_NAMES[monthStart.getMonth()]} ${monthStart.getFullYear()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Collection performance, helpdesk throughput, amenity usage and gate activity."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Collection rate"
          value={`${collection.collectionRate}%`}
          hint={`${formatCurrency(collection.collected)} of ${formatCurrency(collection.billed)}`}
          icon={BadgeIndianRupee}
          tone={collection.collectionRate >= 80 ? 'success' : 'warning'}
        />
        <StatCard
          label="Occupancy"
          value={`${totalFlats > 0 ? Math.round((occupied / totalFlats) * 100) : 0}%`}
          hint={`${occupied} of ${totalFlats} units · ${residentCount} residents`}
          icon={Building2}
        />
        <StatCard
          label="Helpdesk resolution"
          value={complaints.averageResolutionHours > 0 ? `${complaints.averageResolutionHours} h` : '—'}
          hint={`${complaints.counts.RESOLVED + complaints.counts.CLOSED} tickets completed`}
          icon={LifeBuoy}
          tone="info"
        />
        <StatCard
          label="Gate movements"
          value={gateTotal}
          hint="Recorded in the last 30 days"
          icon={ShieldCheck}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Billing and collection trend</CardTitle>
            <CardDescription>Six-month view of amounts billed against amounts collected.</CardDescription>
          </CardHeader>
          <CardContent>
            <CollectionTrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collection by block</CardTitle>
            <CardDescription>All periods combined.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {blockCollection.map((block) => {
              const billed = block.flats.reduce(
                (sum, flat) => sum + flat.bills.reduce((s, bill) => s + Number(bill.totalAmount), 0),
                0,
              );
              const paid = block.flats.reduce(
                (sum, flat) => sum + flat.bills.reduce((s, bill) => s + Number(bill.paidAmount), 0),
                0,
              );
              const rate = billed > 0 ? Math.round((paid / billed) * 100) : 0;

              return (
                <div key={block.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">Block {block.name}</span>
                    <span className="tabular text-muted-foreground">{rate}%</span>
                  </div>
                  <Progress
                    value={rate}
                    indicatorClassName={rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-destructive'}
                  />
                  <p className="tabular mt-1 text-xs text-muted-foreground">
                    {formatCurrency(paid)} of {formatCurrency(billed)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Complaints by category</CardTitle>
            <CardDescription>All tickets on record.</CardDescription>
          </CardHeader>
          <CardContent>
            <ComplaintCategoryChart data={complaints.byCategory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4.5 text-muted-foreground" aria-hidden />
              Technician performance
            </CardTitle>
            <CardDescription>Workload and resident satisfaction.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table containerClassName="border-0 border-t rounded-none">
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Resolved</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffPerformance.map((member) => {
                  const stats = resolvedMap.get(member.id);
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.user.fullName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{humanise(member.department)}</Badge>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {member._count.assignedComplaints}
                      </TableCell>
                      <TableCell className="tabular text-right">{stats?.resolved ?? 0}</TableCell>
                      <TableCell className="tabular text-right">
                        {stats?.rating ? `${stats.rating.toFixed(1)} / 5` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="size-4.5 text-muted-foreground" aria-hidden />
              Amenity usage
            </CardTitle>
            <CardDescription>Bookings in the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {amenityUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings in this period.</p>
            ) : (
              amenityUsage
                .sort((a, b) => b._count._all - a._count._all)
                .map((row) => (
                  <div key={row.amenityId} className="flex items-center justify-between gap-3 text-sm">
                    <span>{amenityNames.get(row.amenityId) ?? 'Amenity'}</span>
                    <span className="tabular text-muted-foreground">
                      {row._count._all} booking(s)
                      {Number(row._sum.fee ?? 0) > 0 ? ` · ${formatCurrency(row._sum.fee ?? 0)}` : ''}
                    </span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-4.5 text-muted-foreground" aria-hidden />
              Gate verification methods
            </CardTitle>
            <CardDescription>How visitors were cleared in the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {gateSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">No gate activity in this period.</p>
            ) : (
              gateSummary
                .sort((a, b) => b._count._all - a._count._all)
                .map((row) => {
                  const percent = gateTotal > 0 ? Math.round((row._count._all / gateTotal) * 100) : 0;
                  return (
                    <div key={row.verificationMethod}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span>{humanise(row.verificationMethod)}</span>
                        <span className="tabular text-muted-foreground">
                          {percent}% · {row._count._all}
                        </span>
                      </div>
                      <Progress value={percent} />
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Billing status breakdown</CardTitle>
          <CardDescription>Every invoice on record, grouped by status ({monthLabel} to date).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table containerClassName="border-0 border-t rounded-none">
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collection.byStatus.map((row) => (
                <TableRow key={row.status}>
                  <TableCell className="font-medium">{humanise(row.status)}</TableCell>
                  <TableCell className="tabular text-right">{row.count}</TableCell>
                  <TableCell className="tabular text-right">{formatCurrency(row.billed)}</TableCell>
                  <TableCell className="tabular text-right">{formatCurrency(row.collected)}</TableCell>
                  <TableCell className="tabular text-right">
                    {formatCurrency(row.billed - row.collected)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
