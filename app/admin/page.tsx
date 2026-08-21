import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarRange,
  DoorOpen,
  IdCard,
  LifeBuoy,
  Siren,
  TriangleAlert,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Progress } from '@/components/ui/misc';
import {
  CollectionTrendChart,
  ComplaintCategoryChart,
  OccupancyDonut,
} from '@/components/charts/dashboard-charts';
import { requireRole } from '@/lib/auth/session';
import { formatCurrency, formatDateTime, formatRelative, humanise, timeOfDayGreeting } from '@/lib/utils';
import { getAdminDashboard } from '@/services/dashboard-service';
import { refreshOverdueStatuses } from '@/services/billing-service';
import { expireStalePasses } from '@/services/gate-service';
import { completeElapsedBookings } from '@/services/amenity-service';
import { closeElapsedPolls } from '@/services/community-service';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function AdminDashboardPage() {
  const user = await requireRole('ADMIN');

  /*
   * Housekeeping that a scheduled job would normally do. Running it here keeps
   * the deployment to a single Node process (SRS §1.8.1) while ensuring the
   * numbers on this page are never stale.
   */
  await Promise.all([
    refreshOverdueStatuses(),
    expireStalePasses(),
    completeElapsedBookings(),
    closeElapsedPolls(),
  ]);

  const data = await getAdminDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title={`Good ${timeOfDayGreeting()}, ${user.fullName.split(' ')[0]}`}
        description="Live operational picture of the society — occupancy, collections, security and the helpdesk queue."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/reports">View reports</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/alerts">
                <Siren className="size-4" />
                Emergency broadcast
              </Link>
            </Button>
          </>
        }
      />

      {data.activeAlert ? (
        <Alert variant="destructive" title={`Active alert: ${data.activeAlert.title}`}>
          Raised {formatRelative(data.activeAlert.startedAt)} · {humanise(data.activeAlert.type)}.{' '}
          <Link href="/admin/alerts" className="font-medium text-foreground underline underline-offset-2">
            Manage or resolve it
          </Link>
        </Alert>
      ) : null}

      {/* ── Primary statistics ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total flats"
          value={data.flats.total}
          hint={`${data.flats.occupied} occupied · ${data.flats.vacant} vacant`}
          icon={Building2}
          href="/admin/flats"
        />
        <StatCard
          label="Residents"
          value={data.residentCount}
          hint={`${data.staffCount} staff members on roll`}
          icon={Users}
          tone="info"
          href="/admin/residents"
        />
        <StatCard
          label="Outstanding dues"
          value={formatCurrency(data.collection.outstanding)}
          hint={`${data.collection.collectionRate}% collected of ${formatCurrency(data.collection.billed)}`}
          icon={Banknote}
          tone={data.collection.outstanding > 0 ? 'warning' : 'success'}
          href="/admin/bills"
        />
        <StatCard
          label="Open complaints"
          value={data.complaints.open}
          hint={`${data.complaints.slaBreached} past their SLA target`}
          icon={LifeBuoy}
          tone={data.complaints.slaBreached > 0 ? 'destructive' : 'default'}
          href="/admin/complaints"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Visitors today"
          value={data.visitorsToday}
          hint={`${data.insideNow} currently inside the society`}
          icon={IdCard}
          tone="info"
          href="/admin/visitors"
        />
        <StatCard
          label="Active gate passes"
          value={data.activePasses}
          hint="Pre-approved and still within their window"
          icon={DoorOpen}
          href="/admin/security"
        />
        <StatCard
          label="Amenity bookings"
          value={data.activeBookings}
          hint="Confirmed or awaiting approval"
          icon={CalendarRange}
          tone="success"
          href="/admin/amenities"
        />
        <StatCard
          label="Collection this cycle"
          value={formatCurrency(data.collection.collected)}
          hint={`${data.collection.billCount} invoices raised`}
          icon={Banknote}
          tone="success"
          href="/admin/payments"
        />
      </section>

      {/* ── Charts ── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Billing and collection</CardTitle>
            <CardDescription>Amount billed against amount collected over the last six months.</CardDescription>
          </CardHeader>
          <CardContent>
            <CollectionTrendChart data={data.trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flat occupancy</CardTitle>
            <CardDescription>{data.flats.occupancyRate}% of units are occupied.</CardDescription>
          </CardHeader>
          <CardContent>
            <OccupancyDonut
              occupied={data.flats.occupied}
              vacant={data.flats.vacant}
              underMaintenance={data.flats.underMaintenance}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Helpdesk by category</CardTitle>
            <CardDescription>
              Average resolution time {data.complaints.averageResolutionHours} hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.complaints.byCategory.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title="No complaints yet"
                description="Tickets raised by residents will be broken down here."
                className="border-0 bg-transparent"
              />
            ) : (
              <ComplaintCategoryChart data={data.complaints.byCategory} />
            )}
          </CardContent>
        </Card>

        {/* ── Recent complaints ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Latest helpdesk tickets</CardTitle>
              <CardDescription>Newest resident complaints across all towers.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/complaints">
                All tickets
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentComplaints.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title="No tickets yet"
                description="Complaints raised by residents will show up here."
                className="m-5 mt-0"
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.recentComplaints.map((complaint) => {
                  const breached =
                    complaint.slaDueAt < new Date() &&
                    (complaint.status === 'PENDING' || complaint.status === 'IN_PROGRESS');
                  return (
                    <li key={complaint.id}>
                      <Link
                        href={`/admin/complaints/${complaint.id}`}
                        className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-accent/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">{complaint.title}</span>
                            <StatusBadge status={complaint.status} />
                            {breached ? (
                              <Badge variant="destructive">
                                <TriangleAlert className="size-3" />
                                SLA breached
                              </Badge>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {complaint.ticketNumber} · Flat {complaint.flat.block.name}-
                            {complaint.flat.flatNumber} · {humanise(complaint.category)} ·{' '}
                            {formatRelative(complaint.createdAt)}
                          </span>
                        </span>
                        <StatusBadge status={complaint.priority} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Gate activity + defaulters ── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Recent gate activity</CardTitle>
              <CardDescription>Entries, exits and refusals across all gates.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/security">
                Gate logs
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentGateLogs.length === 0 ? (
              <EmptyState icon={DoorOpen} title="No gate activity yet" className="m-5 mt-0" />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.recentGateLogs.map((log) => (
                  <li key={log.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{log.visitor.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {humanise(log.visitor.visitorType)} → Flat {log.flat.block.name}-
                        {log.flat.flatNumber} · {log.gate}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <StatusBadge status={log.status} />
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatRelative(log.exitAt ?? log.entryAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Outstanding dues</CardTitle>
              <CardDescription>Invoices past their due date, oldest first.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/bills?status=OVERDUE">
                All dues
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Collection rate</span>
                <span className="tabular font-semibold">{data.collection.collectionRate}%</span>
              </div>
              <Progress
                value={data.collection.collectionRate}
                className="mt-2"
                indicatorClassName={data.collection.collectionRate >= 80 ? 'bg-success' : 'bg-warning'}
              />
            </div>

            {data.topDefaulters.length === 0 ? (
              <EmptyState
                icon={Banknote}
                title="Everything is settled"
                description="No invoice is past its due date right now."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.topDefaulters.map((bill) => (
                  <li key={bill.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        Flat {bill.flat.block.name}-{bill.flat.flatNumber}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {bill.billNumber} · due {formatDateTime(bill.dueDate)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block text-sm font-semibold">
                        {formatCurrency(Number(bill.totalAmount) - Number(bill.paidAmount))}
                      </span>
                      <StatusBadge status={bill.status} className="mt-1" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
