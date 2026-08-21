import type { Metadata } from 'next';
import Link from 'next/link';
import { Phone, QrCode, Ticket } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDateTime, formatRelative, getPassDisplayStatus, humanise } from '@/lib/utils';
import { startOfZonedDay } from '@/lib/timezone';
import { expireStalePasses } from '@/services/gate-service';

export const metadata: Metadata = { title: 'Expected Visitors' };

export default async function ExpectedVisitorsPage() {
  await requireRole('GUARD', 'ADMIN');
  await expireStalePasses();

  const now = new Date();
  const endOfTomorrow = new Date(startOfZonedDay(now).getTime() + 2 * 86_400_000);

  const passes = await prisma.gatePass.findMany({
    where: { status: 'ACTIVE', validUntil: { gt: now }, validFrom: { lt: endOfTomorrow } },
    orderBy: { validFrom: 'asc' },
    include: {
      visitor: true,
      flat: { include: { block: true } },
      resident: { include: { user: { select: { fullName: true, phone: true } } } },
    },
  });

  const live = passes.filter((pass) => pass.validFrom <= now);
  const later = passes.filter((pass) => pass.validFrom > now);

  function PassRow({ pass }: { pass: (typeof passes)[number] }) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{pass.visitor.name}</p>
                <StatusBadge status={getPassDisplayStatus(pass)} />
                {pass.validFrom > now ? (
                  <Badge variant="muted">Starts {formatRelative(pass.validFrom)}</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {humanise(pass.visitorType)}
                {pass.visitor.company ? ` · ${pass.visitor.company}` : ''} · {pass.visitor.phone}
              </p>
              <p className="mt-1 text-sm">
                Visiting <span className="font-medium">Flat {pass.flat.block.name}-{pass.flat.flatNumber}</span>{' '}
                · host {pass.resident.user.fullName}
              </p>
              {pass.purpose ? (
                <p className="mt-1 text-xs text-muted-foreground">{pass.purpose}</p>
              ) : null}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Valid {formatDateTime(pass.validFrom)} — {formatDateTime(pass.validUntil)} ·{' '}
                {pass.entriesUsed}/{pass.maxEntries} entries used
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <Badge variant="soft" className="font-mono text-base">
                {pass.gateCode}
              </Badge>
              {pass.visitor.vehicleNumber ? (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {pass.visitor.vehicleNumber}
                </Badge>
              ) : null}
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${pass.resident.user.phone}`}>
                    <Phone className="size-4" />
                    Host
                  </a>
                </Button>
                <Button asChild size="sm">
                  <Link href="/guard/verify">
                    <QrCode className="size-4" />
                    Verify
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gate"
        title="Expected visitors"
        description="Passes residents have pre-approved for today and tomorrow."
        actions={
          <Button asChild>
            <Link href="/guard/verify">
              <QrCode className="size-4" />
              Verify a pass
            </Link>
          </Button>
        }
      />

      {passes.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No visitors expected"
          description="No resident has pre-approved a visitor for the next two days. Walk-ins can still be logged manually."
          action={
            <Button asChild variant="outline">
              <Link href="/guard/walk-in">Log a walk-in visitor</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Valid right now ({live.length})
            </h2>
            {live.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pass is currently inside its visiting window.
              </p>
            ) : (
              live.map((pass) => <PassRow key={pass.id} pass={pass} />)
            )}
          </section>

          {later.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Coming up ({later.length})
              </h2>
              {later.map((pass) => (
                <PassRow key={pass.id} pass={pass} />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
