import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { DoorOpen, LogOut, ShieldAlert, TriangleAlert, Users } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { GateTrafficChart } from '@/components/charts/dashboard-charts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
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
import { formatDateTime, humanise } from '@/lib/utils';

export const metadata: Metadata = { title: 'Gate Logs' };

const PAGE_SIZE = 25;

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; gate?: string; method?: string; page?: string }>;
}) {
  await requireRole('ADMIN');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.GateLogWhereInput = {
    ...(params.status ? { status: params.status as Prisma.EnumGateLogStatusFilter['equals'] } : {}),
    ...(params.gate ? { gate: params.gate } : {}),
    ...(params.method
      ? { verificationMethod: params.method as Prisma.EnumVerificationMethodFilter['equals'] }
      : {}),
    ...(params.q
      ? {
          OR: [
            { visitor: { name: { contains: params.q, mode: 'insensitive' } } },
            { visitor: { phone: { contains: params.q } } },
            { vehicleNumber: { contains: params.q, mode: 'insensitive' } },
            { flat: { flatNumber: { contains: params.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const [logs, total, insideNow, overstays, deniedWeek, weekLogs] = await Promise.all([
    prisma.gateLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        visitor: true,
        flat: { include: { block: true } },
        guard: { select: { fullName: true } },
      },
    }),
    prisma.gateLog.count({ where }),
    prisma.gateLog.count({ where: { status: 'INSIDE' } }),
    prisma.gateLog.count({ where: { status: 'INSIDE', expectedExitAt: { lt: now } } }),
    prisma.gateLog.count({ where: { status: 'DENIED', createdAt: { gte: weekStart } } }),
    prisma.gateLog.findMany({
      where: { createdAt: { gte: weekStart } },
      select: { entryAt: true, exitAt: true },
    }),
  ]);

  // Build a seven-day entry/exit series for the chart.
  const days: { label: string; entries: number; exits: number }[] = [];
  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - index);
    const next = new Date(day.getTime() + 86_400_000);
    days.push({
      label: day.toLocaleDateString('en-IN', { weekday: 'short' }),
      entries: weekLogs.filter((log) => log.entryAt && log.entryAt >= day && log.entryAt < next).length,
      exits: weekLogs.filter((log) => log.exitAt && log.exitAt >= day && log.exitAt < next).length,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Gate logs"
        description="Real-time entry and exit records for every gate, visitor and staff movement."
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Inside now" value={insideNow} icon={Users} tone="info" />
        <StatCard
          label="Overstaying"
          value={overstays}
          icon={TriangleAlert}
          tone={overstays > 0 ? 'destructive' : 'success'}
        />
        <StatCard label="Entries this week" value={days.reduce((sum, d) => sum + d.entries, 0)} icon={DoorOpen} />
        <StatCard
          label="Refused this week"
          value={deniedWeek}
          icon={ShieldAlert}
          tone={deniedWeek > 0 ? 'warning' : 'default'}
        />
      </section>

      {overstays > 0 ? (
        <Alert variant="warning" title={`${overstays} visitor(s) are past their expected exit time`}>
          The gate console flags these to the guard on duty and notifies the host flat.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Gate traffic — last seven days</CardTitle>
          <CardDescription>Entries and exits recorded across all gates.</CardDescription>
        </CardHeader>
        <CardContent>
          <GateTrafficChart data={days} />
        </CardContent>
      </Card>

      <FilterBar
        searchPlaceholder="Search visitor, phone, vehicle or flat…"
        filters={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'INSIDE', label: 'Inside' },
              { value: 'EXITED', label: 'Exited' },
              { value: 'OVERSTAY', label: 'Overstay' },
              { value: 'DENIED', label: 'Refused' },
            ],
          },
          {
            name: 'gate',
            label: 'Gate',
            options: [
              { value: 'Main Gate', label: 'Main Gate' },
              { value: 'Service Gate', label: 'Service Gate' },
            ],
          },
          {
            name: 'method',
            label: 'Verification',
            options: [
              { value: 'QR_SCAN', label: 'QR scan' },
              { value: 'GATE_CODE', label: 'Gate code' },
              { value: 'MANUAL', label: 'Manual' },
              { value: 'PRE_APPROVED', label: 'Pre-approved' },
            ],
          },
        ]}
      />

      {logs.length === 0 ? (
        <EmptyState
          icon={LogOut}
          title="No gate records match these filters"
          description="Clear the filters to see the full movement log."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Flat</TableHead>
                  <TableHead>Gate</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead>Guard</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <p className="font-medium">{log.visitor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {humanise(log.visitor.visitorType)}
                        {log.visitor.company ? ` · ${log.visitor.company}` : ''}
                      </p>
                      {log.vehicleNumber ? (
                        <Badge variant="outline" className="mt-1 font-mono text-[10px]">
                          {log.vehicleNumber}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {log.flat.block.name}-{log.flat.flatNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{log.gate}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {humanise(log.verificationMethod)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(log.entryAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(log.exitAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {log.guard?.fullName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                      {log.denialReason ? (
                        <p className="mt-1 max-w-44 text-xs text-destructive">{log.denialReason}</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{log.visitor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Flat {log.flat.block.name}-{log.flat.flatNumber} · {log.gate}
                      </p>
                    </div>
                    <StatusBadge status={log.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    In {formatDateTime(log.entryAt)} · Out {formatDateTime(log.exitAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {humanise(log.verificationMethod)}
                    {log.guard ? ` · ${log.guard.fullName}` : ''}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <DataPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  );
}
