import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  IdCard,
  LifeBuoy,
  Megaphone,
  Plus,
  QrCode,
  Vote,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { requireResident } from '@/lib/auth/session';
import { formatCurrency, formatDate, formatDateTime, formatRelative, humanise } from '@/lib/utils';
import { getResidentDashboard } from '@/services/dashboard-service';
import { slaState } from '@/services/complaint-service';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * The resident's home screen — designed around the journey the SRS describes:
 * login → generate a visitor pass → view the monthly bill → book the clubhouse
 * → log a plumbing ticket → track its SLA.
 */
export default async function ResidentDashboardPage() {
  const user = await requireResident();
  const data = await getResidentDashboard(user.residentId, user.flatId);

  const firstName = user.fullName.split(' ')[0];
  const dueBill = data.latestBill;
  const dueOutstanding = dueBill ? Number(dueBill.totalAmount) - Number(dueBill.paidAmount) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Flat ${user.flatLabel}`}
        title={`Hello, ${firstName}`}
        description="Your bills, visitors, tickets and bookings at a glance."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/resident/complaints/new">
                <LifeBuoy className="size-4" />
                Raise a ticket
              </Link>
            </Button>
            <Button asChild>
              <Link href="/resident/visitors/new">
                <QrCode className="size-4" />
                New visitor pass
              </Link>
            </Button>
          </>
        }
      />

      {data.outstanding.amount > 0 ? (
        <Alert variant={dueBill && dueBill.status === 'OVERDUE' ? 'destructive' : 'warning'}>
          You have {formatCurrency(data.outstanding.amount)} outstanding across{' '}
          {data.outstanding.billCount} invoice{data.outstanding.billCount === 1 ? '' : 's'}.{' '}
          <Link href="/resident/bills" className="font-medium text-foreground underline underline-offset-2">
            Pay now
          </Link>
        </Alert>
      ) : null}

      {/* ── Statistics ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Amount due"
          value={formatCurrency(data.outstanding.amount)}
          hint={
            dueBill
              ? `Latest invoice due ${formatDate(dueBill.dueDate)}`
              : 'No invoices raised yet'
          }
          icon={Banknote}
          tone={data.outstanding.amount > 0 ? 'warning' : 'success'}
          href="/resident/bills"
        />
        <StatCard
          label="Open tickets"
          value={data.openComplaints.length}
          hint="Complaints being worked on"
          icon={LifeBuoy}
          tone={data.openComplaints.length > 0 ? 'info' : 'default'}
          href="/resident/complaints"
        />
        <StatCard
          label="Active visitor passes"
          value={data.activePasses.length}
          hint="Valid right now"
          icon={IdCard}
          href="/resident/visitors"
        />
        <StatCard
          label="Upcoming bookings"
          value={data.upcomingBookings.length}
          hint="Amenities reserved for you"
          icon={CalendarCheck}
          tone="success"
          href="/resident/amenities"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* ── Current bill ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Current maintenance bill</CardTitle>
              <CardDescription>
                {dueBill
                  ? `${new Date(dueBill.periodYear, dueBill.periodMonth - 1).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })} · ${dueBill.billNumber}`
                  : 'No invoice has been raised for your flat yet.'}
              </CardDescription>
            </div>
            {dueBill ? <StatusBadge status={dueBill.status} /> : null}
          </CardHeader>

          <CardContent>
            {!dueBill ? (
              <EmptyState
                icon={Banknote}
                title="No bills yet"
                description="Maintenance invoices raised by the society office will appear here."
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total payable</p>
                    <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
                      {formatCurrency(dueBill.totalAmount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Due {formatDate(dueBill.dueDate)}
                      {dueOutstanding > 0 && dueOutstanding !== Number(dueBill.totalAmount)
                        ? ` · ${formatCurrency(dueOutstanding)} still outstanding`
                        : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/resident/bills/${dueBill.id}`}>View breakdown</Link>
                    </Button>
                    {dueOutstanding > 0 ? (
                      <Button asChild size="sm">
                        <Link href={`/resident/bills/${dueBill.id}`}>Pay now</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <ul className="divide-y divide-border rounded-lg border border-border">
                  {dueBill.charges.slice(0, 5).map((charge) => (
                    <li key={charge.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span>{charge.label}</span>
                      <span className="tabular font-medium">{formatCurrency(charge.amount)}</span>
                    </li>
                  ))}
                  {dueBill.charges.length > 5 ? (
                    <li className="px-4 py-2 text-xs text-muted-foreground">
                      +{dueBill.charges.length - 5} more line items
                    </li>
                  ) : null}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Active passes ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Visitor passes</CardTitle>
              <CardDescription>Active pre-approvals.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="icon-sm" aria-label="Create a visitor pass">
              <Link href="/resident/visitors/new">
                <Plus className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.activePasses.length === 0 ? (
              <EmptyState
                icon={QrCode}
                title="No active passes"
                description="Pre-approve a guest and share a QR code with them."
                action={
                  <Button asChild size="sm">
                    <Link href="/resident/visitors/new">Create a pass</Link>
                  </Button>
                }
                className="m-5 mt-0"
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.activePasses.map((pass) => (
                  <li key={pass.id}>
                    <Link
                      href={`/resident/visitors/${pass.id}`}
                      className="block px-5 py-3 transition-colors hover:bg-accent/50"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{pass.visitor.name}</span>
                        <Badge variant="soft" className="tabular font-mono">
                          {pass.gateCode}
                        </Badge>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {humanise(pass.visitorType)} · valid until {formatDateTime(pass.validUntil)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* ── Tickets with SLA ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>My open tickets</CardTitle>
              <CardDescription>Track progress against the service target.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/resident/complaints">
                All tickets
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.openComplaints.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title="Nothing pending"
                description="Raise a ticket if something in your flat or the common areas needs attention."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/resident/complaints/new">Raise a ticket</Link>
                  </Button>
                }
                className="m-5 mt-0"
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.openComplaints.map((complaint) => {
                  const sla = slaState(complaint);
                  return (
                    <li key={complaint.id}>
                      <Link
                        href={`/resident/complaints/${complaint.id}`}
                        className="block px-5 py-3.5 transition-colors hover:bg-accent/50"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {complaint.title}
                          </span>
                          <StatusBadge status={complaint.status} />
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{complaint.ticketNumber}</span>
                          <span aria-hidden>·</span>
                          <span>{humanise(complaint.category)}</span>
                          <span aria-hidden>·</span>
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
                          <span>due {formatRelative(complaint.slaDueAt)}</span>
                        </span>
                        {complaint.assignedStaff ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Assigned to {complaint.assignedStaff.user.fullName}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Bookings ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Upcoming bookings</CardTitle>
              <CardDescription>Amenities you have reserved.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/resident/amenities">
                Book
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.upcomingBookings.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No bookings"
                description="Reserve the clubhouse, pool, gym or a sports court."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href="/resident/amenities">Browse amenities</Link>
                  </Button>
                }
                className="m-5 mt-0"
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.upcomingBookings.map((booking) => (
                  <li key={booking.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{booking.amenity.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(booking.startsAt)} · {booking.bookingCode}
                      </span>
                    </span>
                    <StatusBadge status={booking.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* ── Notices ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Notice board</CardTitle>
              <CardDescription>Announcements from the society office.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/resident/notices">
                All notices
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.pinnedNotices.length === 0 ? (
              <EmptyState icon={Megaphone} title="No notices right now" className="m-5 mt-0" />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.pinnedNotices.map((notice) => (
                  <li key={notice.id}>
                    <Link
                      href={`/resident/notices/${notice.id}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-accent/50"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{notice.title}</span>
                        {notice.isPinned ? <Badge variant="soft">Pinned</Badge> : null}
                        {notice.priority === 'URGENT' || notice.priority === 'HIGH' ? (
                          <StatusBadge status={notice.priority} />
                        ) : null}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {humanise(notice.category)} · {formatRelative(notice.publishAt)}
                        {notice.eventDate ? ` · event on ${formatDate(notice.eventDate)}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Polls ── */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Community polls</CardTitle>
              <CardDescription>Have your say on society decisions.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/resident/polls">
                All polls
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.openPolls.length === 0 ? (
              <EmptyState icon={Vote} title="No open polls" className="m-5 mt-0" />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.openPolls.map((poll) => (
                  <li key={poll.id}>
                    <Link
                      href="/resident/polls"
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{poll.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          Closes {formatRelative(poll.endsAt)}
                        </span>
                      </span>
                      <Badge variant={poll.hasVoted ? 'success' : 'warning'}>
                        {poll.hasVoted ? 'Voted' : 'Vote now'}
                      </Badge>
                    </Link>
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
