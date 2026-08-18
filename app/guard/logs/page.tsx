import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { ClipboardList } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { ExitButton } from '@/app/guard/exit-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
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

export const metadata: Metadata = { title: 'Visitor Log' };

const PAGE_SIZE = 25;

const STATUS_FILTER = {
  name: 'status',
  label: 'Status',
  options: [
    { value: 'INSIDE', label: 'Inside now' },
    { value: 'EXITED', label: 'Exited' },
    { value: 'OVERSTAY', label: 'Overstay' },
    { value: 'DENIED', label: 'Refused' },
  ],
};

const TYPE_FILTER = {
  name: 'type',
  label: 'Visitor type',
  options: [
    { value: 'GUEST', label: 'Guest' },
    { value: 'DELIVERY', label: 'Delivery' },
    { value: 'CAB', label: 'Cab' },
    { value: 'VENDOR', label: 'Vendor' },
    { value: 'SERVICE', label: 'Service' },
    { value: 'OTHER', label: 'Other' },
  ],
};

const GATE_FILTER = {
  name: 'gate',
  label: 'Gate',
  options: [
    { value: 'Main Gate', label: 'Main Gate' },
    { value: 'Service Gate', label: 'Service Gate' },
  ],
};

export default async function GuardLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; gate?: string; page?: string }>;
}) {
  await requireRole('GUARD', 'ADMIN');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.GateLogWhereInput = {
    ...(params.status ? { status: params.status as Prisma.EnumGateLogStatusFilter['equals'] } : {}),
    ...(params.gate ? { gate: params.gate } : {}),
    ...(params.type
      ? { visitor: { visitorType: params.type as Prisma.EnumVisitorTypeFilter['equals'] } }
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

  const [logs, total] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records"
        title="Visitor log"
        description="Every entry, exit and refusal recorded at the society gates."
      />

      <FilterBar
        searchPlaceholder="Search name, phone, vehicle or flat…"
        filters={[STATUS_FILTER, TYPE_FILTER, GATE_FILTER]}
      />

      {logs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No matching entries"
          description="Adjust the filters, or clear the search to see the full log."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Visiting</TableHead>
                  <TableHead>Gate</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead>Verified by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <p className="font-medium">{log.visitor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {humanise(log.visitor.visitorType)}
                        {log.visitor.company ? ` · ${log.visitor.company}` : ''} · {log.visitor.phone}
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
                    <TableCell className="whitespace-nowrap">
                      <p>{log.gate}</p>
                      <p className="text-xs text-muted-foreground">
                        {humanise(log.verificationMethod)}
                      </p>
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
                        <p className="mt-1 max-w-48 text-xs text-destructive">{log.denialReason}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.status === 'INSIDE' || log.status === 'OVERSTAY' ? (
                        <ExitButton gateLogId={log.id} visitorName={log.visitor.name} compact />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile / tablet cards */}
          <div className="grid gap-3 lg:hidden">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{log.visitor.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {humanise(log.visitor.visitorType)} → Flat {log.flat.block.name}-
                        {log.flat.flatNumber}
                      </p>
                    </div>
                    <StatusBadge status={log.status} />
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Entry</dt>
                      <dd className="mt-0.5 font-medium">{formatDateTime(log.entryAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Exit</dt>
                      <dd className="mt-0.5 font-medium">{formatDateTime(log.exitAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Gate</dt>
                      <dd className="mt-0.5 font-medium">{log.gate}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Method</dt>
                      <dd className="mt-0.5 font-medium">{humanise(log.verificationMethod)}</dd>
                    </div>
                  </dl>

                  {log.denialReason ? (
                    <p className="text-xs text-destructive">{log.denialReason}</p>
                  ) : null}

                  {log.status === 'INSIDE' || log.status === 'OVERSTAY' ? (
                    <ExitButton gateLogId={log.id} visitorName={log.visitor.name} />
                  ) : null}
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
