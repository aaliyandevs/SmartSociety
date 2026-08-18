import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ClipboardList, ListChecks, MessageSquare, Timer } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { requireRole } from '@/lib/auth/session';
import { formatRelative, humanise } from '@/lib/utils';
import { getStaffDashboard } from '@/services/dashboard-service';
import { slaState } from '@/services/complaint-service';
import prisma from '@/lib/prisma';

export const metadata: Metadata = { title: 'My Work' };

export default async function StaffDashboardPage() {
  const user = await requireRole('MAINTENANCE_STAFF', 'ADMIN');

  // An administrator previewing this console sees the first technician's queue.
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
        <PageHeader title="My work" description="Assigned helpdesk tickets." />
        <EmptyState
          icon={ListChecks}
          title="No staff profile linked"
          description="Your account is not linked to a maintenance staff profile yet. Contact the society office."
        />
      </div>
    );
  }

  const data = await getStaffDashboard(staffId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={user.department ? humanise(user.department) : 'Maintenance'}
        title={`Hello, ${user.fullName.split(' ')[0]}`}
        description="Tickets routed to you, ordered by how soon they are due."
        actions={
          <Button asChild variant="outline">
            <Link href="/staff/tickets">
              <ListChecks className="size-4" />
              All assigned tickets
            </Link>
          </Button>
        }
      />

      {user.role === 'ADMIN' ? (
        <Alert variant="info" title="Administrator preview">
          You are viewing a technician&apos;s console. Status changes you make here are recorded under your
          own name in the audit log.
        </Alert>
      ) : null}

      {data.dueSoon > 0 ? (
        <Alert variant="warning" title="SLA deadline approaching">
          {data.dueSoon} of your open ticket{data.dueSoon === 1 ? ' is' : 's are'} due within the next four
          hours.
        </Alert>
      ) : null}

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tickets" value={data.open} icon={ListChecks} tone="info" href="/staff/tickets" />
        <StatCard
          label="Due within 4 hours"
          value={data.dueSoon}
          icon={Timer}
          tone={data.dueSoon > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Resolved this week"
          value={data.resolvedThisWeek}
          icon={CheckCircle2}
          tone="success"
          href="/staff/history"
        />
        <StatCard
          label="Closed all-time"
          value={data.counts.CLOSED + data.counts.RESOLVED}
          icon={ClipboardList}
          href="/staff/history"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>My queue</CardTitle>
              <CardDescription>Most urgent first, based on the service-level target.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/staff/tickets">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.queue.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Queue is clear"
                description="You have no open tickets right now. New assignments will appear here."
                className="m-5 mt-0"
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.queue.map((ticket) => {
                  const sla = slaState(ticket);
                  return (
                    <li key={ticket.id}>
                      <Link
                        href={`/staff/tickets/${ticket.id}`}
                        className="block px-5 py-4 transition-colors hover:bg-accent/50"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{ticket.title}</span>
                          <StatusBadge status={ticket.priority} />
                          <StatusBadge status={ticket.status} />
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {ticket.ticketNumber} · Flat {ticket.flat.block.name}-{ticket.flat.flatNumber} ·{' '}
                          {humanise(ticket.category)}
                          {ticket.location ? ` · ${ticket.location}` : ''}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
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
                          <span className="text-muted-foreground">
                            Due {formatRelative(ticket.slaDueAt)} · raised by{' '}
                            {ticket.resident.user.fullName}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest notes on your tickets.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentUpdates.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No activity yet" className="m-5 mt-0" />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.recentUpdates.map((update) => (
                  <li key={update.id} className="px-5 py-3.5">
                    <Link
                      href={`/staff/tickets/${update.complaint.id}`}
                      className="block text-sm font-medium hover:underline"
                    >
                      {update.complaint.ticketNumber}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{update.note}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {update.author?.fullName ?? 'System'} · {formatRelative(update.createdAt)}
                    </p>
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
