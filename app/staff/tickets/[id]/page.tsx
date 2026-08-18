import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, Paperclip, Phone, User } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { ComplaintTimeline } from '@/components/shared/complaint-timeline';
import { TicketWorkPanel } from '@/app/staff/tickets/[id]/work-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDateTime, formatRelative, humanise } from '@/lib/utils';
import { complaintDetailInclude, slaState } from '@/services/complaint-service';

export const metadata: Metadata = { title: 'Ticket' };

export default async function StaffTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole('MAINTENANCE_STAFF', 'ADMIN');

  const ticket = await prisma.complaint.findFirst({
    where: {
      id,
      deletedAt: null,
      // A technician can only open a ticket assigned to them.
      ...(user.role === 'MAINTENANCE_STAFF' ? { assignedStaffId: user.staffId ?? '__none__' } : {}),
    },
    include: complaintDetailInclude,
  });

  if (!ticket) notFound();

  const sla = slaState(ticket);
  const flatLabel = `${ticket.flat.block.name}-${ticket.flat.flatNumber}`;
  const isSettled = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/staff/tickets">
          <ArrowLeft className="size-4" />
          Back to my tickets
        </Link>
      </Button>

      <PageHeader
        eyebrow={ticket.ticketNumber}
        title={ticket.title}
        description={`${humanise(ticket.category)} · Flat ${flatLabel}${ticket.location ? ` · ${ticket.location}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        }
      />

      {sla.overdue && !isSettled ? (
        <Alert variant="destructive" title="This ticket has passed its service-level target">
          It was due {formatRelative(ticket.slaDueAt)}. Update the status with a note so the resident and
          the office know where it stands.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Reported problem</CardTitle>
              <CardDescription>Raised {formatDateTime(ticket.createdAt)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-line text-sm">{ticket.description}</p>

              {ticket.attachments.length > 0 ? (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Paperclip className="size-3.5" aria-hidden />
                    Photos from the resident ({ticket.attachments.length})
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {ticket.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={`/api/files/${attachment.storageKey}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                      >
                        <Image
                          src={`/api/files/${attachment.storageKey}`}
                          alt={attachment.fileName}
                          fill
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover transition-transform group-hover:scale-105"
                          unoptimized
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update this ticket</CardTitle>
              <CardDescription>
                Every change is recorded in the history below and the resident is notified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TicketWorkPanel
                complaintId={ticket.id}
                currentStatus={ticket.status}
                canClose={user.role === 'ADMIN'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Status changes and work notes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ComplaintTimeline updates={ticket.updates} showInternal />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-muted-foreground" aria-hidden />
                Service level
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Target</dt>
                  <dd className="text-right font-medium">{formatDateTime(ticket.slaDueAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Assigned</dt>
                  <dd className="text-right font-medium">{formatDateTime(ticket.assignedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Resolved</dt>
                  <dd className="text-right font-medium">{formatDateTime(ticket.resolvedAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="size-4 text-muted-foreground" aria-hidden />
                Resident contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{ticket.resident.user.fullName}</p>
                <p className="text-sm text-muted-foreground">Flat {flatLabel}</p>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {ticket.flat.block.label ?? `Block ${ticket.flat.block.name}`}, floor{' '}
                  {ticket.flat.floor}
                  {ticket.location ? ` — ${ticket.location}` : ''}
                </span>
              </div>
              <Button asChild variant="outline" className="w-full">
                <a href={`tel:${ticket.resident.user.phone}`}>
                  <Phone className="size-4" />
                  {ticket.resident.user.phone}
                </a>
              </Button>
            </CardContent>
          </Card>

          {ticket.resolutionNotes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resolution notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {ticket.resolutionNotes}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
