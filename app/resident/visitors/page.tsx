import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, Plus, QrCode, Users } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDateTime, formatRelative, getPassDisplayStatus, humanise } from '@/lib/utils';
import { expireStalePasses } from '@/services/gate-service';

export const metadata: Metadata = { title: 'Visitor Passes' };

function PassCard({
  pass,
}: {
  pass: {
    id: string;
    passCode: string;
    gateCode: string;
    status: string;
    visitorType: string;
    purpose: string | null;
    validFrom: Date;
    validUntil: Date;
    maxEntries: number;
    entriesUsed: number;
    visitor: { name: string; phone: string; vehicleNumber: string | null; company: string | null };
  };
}) {
  const isActive = pass.status === 'ACTIVE';

  return (
    <Link
      href={`/resident/visitors/${pass.id}`}
      className="block rounded-xl border border-border bg-card p-4 transition-shadow hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{pass.visitor.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {humanise(pass.visitorType)}
            {pass.visitor.company ? ` · ${pass.visitor.company}` : ''} · {pass.visitor.phone}
          </p>
        </div>
        <StatusBadge status={getPassDisplayStatus(pass)} />
      </div>

      {pass.purpose ? (
        <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{pass.purpose}</p>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Valid from</dt>
          <dd className="mt-0.5 font-medium">{formatDateTime(pass.validFrom)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Valid until</dt>
          <dd className="mt-0.5 font-medium">{formatDateTime(pass.validUntil)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Badge variant={isActive ? 'soft' : 'muted'} className="font-mono text-sm">
          {pass.gateCode}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {pass.entriesUsed}/{pass.maxEntries} entries used
        </span>
        {pass.visitor.vehicleNumber ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            {pass.visitor.vehicleNumber}
          </Badge>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {isActive ? `expires ${formatRelative(pass.validUntil)}` : formatRelative(pass.validUntil)}
        </span>
      </div>
    </Link>
  );
}

export default async function ResidentVisitorsPage() {
  const user = await requireResident();
  await expireStalePasses();

  const now = new Date();
  const [active, past, recentArrivals] = await Promise.all([
    prisma.gatePass.findMany({
      where: { residentId: user.residentId, status: 'ACTIVE', validUntil: { gt: now } },
      orderBy: { validFrom: 'asc' },
      include: { visitor: true },
    }),
    prisma.gatePass.findMany({
      where: {
        residentId: user.residentId,
        OR: [{ status: { in: ['USED', 'EXPIRED', 'CANCELLED', 'REJECTED'] } }, { validUntil: { lte: now } }],
      },
      orderBy: { validUntil: 'desc' },
      take: 30,
      include: { visitor: true },
    }),
    prisma.gateLog.findMany({
      where: { flatId: user.flatId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { visitor: true, guard: { select: { fullName: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Visitor passes"
        description="Pre-approve guests, delivery drivers and cabs. Each pass carries a QR code and a 6-digit gate code."
        actions={
          <Button asChild>
            <Link href="/resident/visitors/new">
              <Plus className="size-4" />
              New pass
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="arrivals">Gate activity</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {active.length === 0 ? (
            <EmptyState
              icon={QrCode}
              title="No active passes"
              description="Create a pass and share the QR code or gate code with your visitor. The guard can clear them in seconds."
              action={
                <Button asChild>
                  <Link href="/resident/visitors/new">Create a visitor pass</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {active.map((pass) => (
                <PassCard key={pass.id} pass={pass} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past">
          {past.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No past passes yet" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {past.map((pass) => (
                <PassCard key={pass.id} pass={pass} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="arrivals">
          <Card>
            <CardHeader>
              <CardTitle>Visitors to your flat</CardTitle>
              <CardDescription>
                Every entry and exit recorded at the gate for flat {user.flatLabel}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {recentArrivals.length === 0 ? (
                <EmptyState icon={Users} title="No gate activity yet" className="m-5 mt-0" />
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {recentArrivals.map((log) => (
                    <li key={log.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{log.visitor.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {humanise(log.visitor.visitorType)}
                          {log.visitor.company ? ` · ${log.visitor.company}` : ''} · {log.gate}
                          {log.guard ? ` · cleared by ${log.guard.fullName}` : ''}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {log.entryAt ? `In ${formatDateTime(log.entryAt)}` : 'Not admitted'}
                          {log.exitAt ? ` · Out ${formatDateTime(log.exitAt)}` : ''}
                        </span>
                      </span>
                      <StatusBadge status={log.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
