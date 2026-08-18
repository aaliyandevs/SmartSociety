import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Paperclip, Phone, Star, User } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { ComplaintTimeline } from '@/components/shared/complaint-timeline';
import { AssignPanel } from '@/app/admin/complaints/[id]/assign-panel';
import { TicketWorkPanel } from '@/app/staff/tickets/[id]/work-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { cn, formatDateTime, formatRelative, humanise } from '@/lib/utils';
import { complaintDetailInclude, getAssignableStaff, slaState } from '@/services/complaint-service';

export const metadata: Metadata = { title: 'Ticket' };

export default async function AdminComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole('ADMIN');

  const ticket = await prisma.complaint.findFirst({
    where: { id, deletedAt: null },
    include: complaintDetailInclude,
  });

  if (!ticket) notFound();

  const staff = await getAssignableStaff(ticket.category);
  const sla = slaState(ticket);
  const flatLabel = `${ticket.flat.block.name}-${ticket.flat.flatNumber}`;
  const isSettled = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/complaints">
          <ArrowLeft className="size-4" />
          Back to complaints
        </Link>
      </Button>

      <PageHeader
        eyebrow={ticket.ticketNumber}
        title={ticket.title}
        description={`${humanise(ticket.category)} · Flat ${flatLabel} · raised ${formatRelative(ticket.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        }
      />

      {sla.overdue && !isSettled ? (
        <Alert variant="destructive" title="This ticket has breached its service-level target">
          It was due {formatRelative(ticket.slaDueAt)}. Escalate it or reassign it to a technician with
          capacity.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Reported problem</CardTitle>
              <CardDescription>
                {formatDateTime(ticket.createdAt)} by {ticket.resident.user.fullName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-line text-sm">{ticket.description}</p>
              {ticket.location ? (
                <p className="text-sm text-muted-foreground">Location: {ticket.location}</p>
              ) : null}

              {ticket.attachments.length > 0 ? (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Paperclip className="size-3.5" aria-hidden />
                    Attached photos ({ticket.attachments.length})
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
              <CardTitle>Assign & route</CardTitle>
              <CardDescription>
                Technicians whose department matches the category are recommended first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AssignPanel
                complaintId={ticket.id}
                currentStaffId={ticket.assignedStaffId}
                currentPriority={ticket.priority}
                staff={staff}
                disabled={ticket.status === 'CLOSED'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update status</CardTitle>
              <CardDescription>
                Administrators can move a ticket to any state, including closing it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TicketWorkPanel complaintId={ticket.id} currentStatus={ticket.status} canClose />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Full history</CardTitle>
              <CardDescription>Including internal maintenance notes.</CardDescription>
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
                {[
                  ['Raised', formatDateTime(ticket.createdAt)],
                  ['Target', formatDateTime(ticket.slaDueAt)],
                  ['First response', formatDateTime(ticket.firstResponseAt)],
                  ['Resolved', formatDateTime(ticket.resolvedAt)],
                  ['Closed', formatDateTime(ticket.closedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="size-4 text-muted-foreground" aria-hidden />
                Resident
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{ticket.resident.user.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  Flat {flatLabel} · {humanise(ticket.resident.residentType)}
                </p>
                <p className="truncate text-xs text-muted-foreground">{ticket.resident.user.email}</p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <a href={`tel:${ticket.resident.user.phone}`}>
                  <Phone className="size-4" />
                  {ticket.resident.user.phone}
                </a>
              </Button>
            </CardContent>
          </Card>

          {ticket.assignedStaff ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Assigned technician</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{ticket.assignedStaff.user.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {ticket.assignedStaff.designation} · {humanise(ticket.assignedStaff.department)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Assigned {formatDateTime(ticket.assignedAt)}
                </p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <a href={`tel:${ticket.assignedStaff.user.phone}`}>
                    <Phone className="size-4" />
                    {ticket.assignedStaff.user.phone}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {ticket.satisfaction ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resident rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className={cn(
                        'size-5',
                        index < ticket.satisfaction!
                          ? 'fill-warning text-warning'
                          : 'text-muted-foreground/40',
                      )}
                      aria-hidden
                    />
                  ))}
                  <span className="ml-2 text-sm font-medium">{ticket.satisfaction} / 5</span>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
