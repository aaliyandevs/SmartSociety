import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Paperclip, Wrench } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { ComplaintTimeline } from '@/components/shared/complaint-timeline';
import { ResidentTicketActions } from '@/app/resident/complaints/[id]/ticket-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDateTime, formatRelative, humanise } from '@/lib/utils';
import { complaintDetailInclude, slaState } from '@/services/complaint-service';

export const metadata: Metadata = { title: 'Ticket' };

export default async function ResidentComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireResident();

  const ticket = await prisma.complaint.findFirst({
    where: { id, residentId: user.residentId, deletedAt: null },
    include: complaintDetailInclude,
  });

  if (!ticket) notFound();

  const sla = slaState(ticket);
  const isSettled = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/resident/complaints">
          <ArrowLeft className="size-4" />
          Back to my complaints
        </Link>
      </Button>

      <PageHeader
        eyebrow={ticket.ticketNumber}
        title={ticket.title}
        description={`${humanise(ticket.category)} · raised ${formatRelative(ticket.createdAt)}${ticket.location ? ` · ${ticket.location}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        }
      />

      {ticket.status === 'PENDING' ? (
        <Alert variant="info" title="Waiting for assignment">
          The society office will route this ticket to a technician. Target first response{' '}
          {formatRelative(ticket.slaDueAt)}.
        </Alert>
      ) : null}
      {sla.overdue && !isSettled ? (
        <Alert variant="warning" title="This ticket has passed its target time">
          The society office has been notified. You can add a note below to follow up.
        </Alert>
      ) : null}
      {ticket.status === 'RESOLVED' && !ticket.satisfaction ? (
        <Alert variant="success" title="This ticket has been marked resolved">
          If the problem is fixed, please rate the work below. If it is not, add a note and the office will
          reopen it.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>What you reported</CardTitle>
              <CardDescription>{formatDateTime(ticket.createdAt)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-line text-sm">{ticket.description}</p>

              {ticket.attachments.length > 0 ? (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Paperclip className="size-3.5" aria-hidden />
                    Photos you attached ({ticket.attachments.length})
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
              <CardTitle>Progress</CardTitle>
              <CardDescription>
                Updates from the society office and the assigned technician.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Internal maintenance notes are filtered out for residents. */}
              <ComplaintTimeline updates={ticket.updates} showInternal={false} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow up</CardTitle>
              <CardDescription>
                Add a note for the technician, or rate the work once it is resolved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResidentTicketActions
                complaintId={ticket.id}
                status={ticket.status}
                satisfaction={ticket.satisfaction}
              />
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
                  <dt className="text-muted-foreground">First response</dt>
                  <dd className="text-right font-medium">{formatDateTime(ticket.firstResponseAt)}</dd>
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
                <Wrench className="size-4 text-muted-foreground" aria-hidden />
                Assigned technician
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.assignedStaff ? (
                <div className="space-y-1">
                  <p className="font-medium">{ticket.assignedStaff.user.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {ticket.assignedStaff.designation} · {humanise(ticket.assignedStaff.department)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Assigned {formatDateTime(ticket.assignedAt)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not assigned yet. The society office reviews new tickets during office hours.
                </p>
              )}
            </CardContent>
          </Card>

          {ticket.resolutionNotes ? (
            <Card className="border-success/40">
              <CardHeader>
                <CardTitle className="text-sm">How it was resolved</CardTitle>
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
