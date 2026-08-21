import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Clock, Download, Phone, ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { CancelPassButton, CopyCodeButton } from '@/app/resident/visitors/[id]/pass-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Separator } from '@/components/ui/misc';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDateTime, formatRelative, getPassDisplayStatus, humanise } from '@/lib/utils';
import { renderQrDataUrl } from '@/services/qr-service';

export const metadata: Metadata = { title: 'Visitor Pass' };

export default async function GatePassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResident();

  // Scoped by residentId — a resident can never open someone else's pass.
  const pass = await prisma.gatePass.findFirst({
    where: { id, residentId: user.residentId },
    include: {
      visitor: true,
      flat: { include: { block: true } },
      gateLogs: {
        orderBy: { createdAt: 'desc' },
        include: { guard: { select: { fullName: true } } },
      },
    },
  });

  if (!pass) notFound();

  const now = new Date();
  const isLive = pass.status === 'ACTIVE' && pass.validFrom <= now && pass.validUntil > now;
  const notYetValid = pass.status === 'ACTIVE' && pass.validFrom > now;
  const canCancel = pass.status === 'ACTIVE' && pass.entriesUsed === 0;
  const qrDataUrl = await renderQrDataUrl(pass.qrToken, 320);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/resident/visitors">
          <ArrowLeft className="size-4" />
          Back to visitor passes
        </Link>
      </Button>

      <PageHeader
        eyebrow={pass.passCode}
        title={pass.visitor.name}
        description={`${humanise(pass.visitorType)} visiting flat ${pass.flat.block.name}-${pass.flat.flatNumber}`}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/api/passes/${pass.id}/pdf`} download>
                <Download className="size-4" />
                Download pass
              </a>
            </Button>
            {canCancel ? <CancelPassButton passId={pass.id} visitorName={pass.visitor.name} /> : null}
          </>
        }
      />

      {notYetValid ? (
        <Alert variant="info" title="This pass is not active yet">
          It becomes valid at {formatDateTime(pass.validFrom)} ({formatRelative(pass.validFrom)}).
        </Alert>
      ) : null}
      {pass.status === 'EXPIRED' ? (
        <Alert variant="warning" title="This pass has expired">
          The visit window closed at {formatDateTime(pass.validUntil)}. Create a new pass if your visitor is
          still coming.
        </Alert>
      ) : null}
      {pass.status === 'CANCELLED' ? (
        <Alert variant="warning" title="This pass was cancelled">
          {pass.cancelReason ?? 'It can no longer be used at the gate.'}
        </Alert>
      ) : null}
      {pass.status === 'REJECTED' ? (
        <Alert variant="destructive" title="Entry was refused on this pass">
          Contact the security desk if you believe this was a mistake.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── The pass itself ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="items-center text-center">
            <StatusBadge status={getPassDisplayStatus(pass)} />
            <CardTitle className="mt-1">Show this at the gate</CardTitle>
            <CardDescription>The guard can scan the code or type the number below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mx-auto w-fit rounded-xl border border-border bg-white p-4">
              <Image
                src={qrDataUrl}
                alt={`QR gate pass for ${pass.visitor.name}`}
                width={220}
                height={220}
                className={isLive ? '' : 'opacity-35 grayscale'}
                unoptimized
              />
            </div>

            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gate code</p>
              <p className="tabular mt-1 font-mono text-3xl font-semibold tracking-[0.25em]">
                {pass.gateCode}
              </p>
              <CopyCodeButton code={pass.gateCode} />
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden />
              {pass.entriesUsed}/{pass.maxEntries} entries used
            </div>
          </CardContent>
        </Card>

        {/* ── Details + timeline ── */}
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Pass details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {[
                  ['Visitor', pass.visitor.name],
                  ['Phone', pass.visitor.phone],
                  ['Visitor type', humanise(pass.visitorType)],
                  ['Company', pass.visitor.company ?? '—'],
                  ['Vehicle', pass.visitor.vehicleNumber ?? 'Not provided'],
                  ['Pass reference', pass.passCode],
                  ['Valid from', formatDateTime(pass.validFrom)],
                  ['Valid until', formatDateTime(pass.validUntil)],
                  ['Purpose', pass.purpose ?? 'Not specified'],
                  ['Created', formatDateTime(pass.createdAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 text-sm font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              <Separator className="my-5" />

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${pass.visitor.phone}`}>
                    <Phone className="size-4" />
                    Call visitor
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`sms:${pass.visitor.phone}?body=${encodeURIComponent(
                      `Your gate pass for flat ${pass.flat.block.name}-${pass.flat.flatNumber}: gate code ${pass.gateCode}, valid until ${formatDateTime(pass.validUntil)}.`,
                    )}`}
                  >
                    Send the code by SMS
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gate activity</CardTitle>
              <CardDescription>Every time this pass was presented at a gate.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {pass.gateLogs.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="Not used yet"
                  description="Entries and exits recorded against this pass will appear here."
                  className="m-5 mt-0"
                />
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {pass.gateLogs.map((log) => (
                    <li key={log.id} className="flex items-start gap-3 px-5 py-4">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={log.status} />
                          <Badge variant="outline">{log.gate}</Badge>
                          <Badge variant="muted">{humanise(log.verificationMethod)}</Badge>
                        </span>
                        <span className="mt-1.5 block text-sm">
                          {log.entryAt ? `Entered ${formatDateTime(log.entryAt)}` : 'Entry refused'}
                          {log.exitAt ? ` · Exited ${formatDateTime(log.exitAt)}` : ''}
                        </span>
                        {log.denialReason ? (
                          <span className="mt-0.5 block text-xs text-destructive">{log.denialReason}</span>
                        ) : null}
                        {log.guard ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            Handled by {log.guard.fullName}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
