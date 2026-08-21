import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { Lock, ScrollText, ShieldCheck, User } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { ROLE_LABELS } from '@/lib/rbac';
import { formatDateTime, formatRelative, humanise } from '@/lib/utils';

export const metadata: Metadata = { title: 'Audit Logs' };

const PAGE_SIZE = 30;

/** Groups the action strings into the categories the filter offers. */
const ACTION_GROUPS: { value: string; label: string; prefix: string }[] = [
  { value: 'auth', label: 'Authentication', prefix: 'auth.' },
  { value: 'gate', label: 'Gate & security', prefix: 'gate' },
  { value: 'bill', label: 'Billing', prefix: 'bill' },
  { value: 'payment', label: 'Payments', prefix: 'payment' },
  { value: 'complaint', label: 'Helpdesk', prefix: 'complaint' },
  { value: 'resident', label: 'Residents', prefix: 'resident' },
  { value: 'flat', label: 'Flats', prefix: 'flat' },
  { value: 'staff', label: 'Staff', prefix: 'staff' },
  { value: 'booking', label: 'Bookings', prefix: 'booking' },
  { value: 'notice', label: 'Notices', prefix: 'notice' },
  { value: 'poll', label: 'Polls', prefix: 'poll' },
  { value: 'alert', label: 'Emergency alerts', prefix: 'alert' },
  { value: 'settings', label: 'Settings', prefix: 'settings' },
];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string; role?: string; page?: string }>;
}) {
  await requireRole('ADMIN');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const group = ACTION_GROUPS.find((entry) => entry.value === params.group);

  const where: Prisma.AuditLogWhereInput = {
    ...(group ? { action: { startsWith: group.prefix } } : {}),
    ...(params.role ? { actorRole: params.role as Prisma.EnumRoleFilter['equals'] } : {}),
    ...(params.q
      ? {
          OR: [
            { description: { contains: params.q, mode: 'insensitive' } },
            { actorName: { contains: params.q, mode: 'insensitive' } },
            { action: { contains: params.q, mode: 'insensitive' } },
            { entityType: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [entries, total, todayCount, financialCount, gateCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.auditLog.count({
      where: { OR: [{ action: { startsWith: 'bill' } }, { action: { startsWith: 'payment' } }] },
    }),
    prisma.auditLog.count({ where: { action: { startsWith: 'gate' } } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        title="Audit log"
        description="An immutable record of every security, financial and administrative action."
      />

      <Alert variant="info" title="This log is append-only">
        Entries can never be edited or deleted from within the application. Gate entries, complaint status
        changes and administrative financial edits are all captured here.
      </Alert>

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total entries" value={total} icon={ScrollText} />
        <StatCard label="Today" value={todayCount} icon={Lock} tone="info" />
        <StatCard label="Financial actions" value={financialCount} icon={ShieldCheck} tone="warning" />
        <StatCard label="Gate actions" value={gateCount} icon={User} tone="success" />
      </section>

      <FilterBar
        searchPlaceholder="Search description, actor or action…"
        filters={[
          {
            name: 'group',
            label: 'Category',
            options: ACTION_GROUPS.map((entry) => ({ value: entry.value, label: entry.label })),
          },
          {
            name: 'role',
            label: 'Actor role',
            options: (['ADMIN', 'RESIDENT', 'GUARD', 'MAINTENANCE_STAFF'] as const).map((role) => ({
              value: role,
              label: ROLE_LABELS[role],
            })),
          },
        ]}
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit entries match these filters"
          description="Clear the filters to see the full trail."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      <p>{formatDateTime(entry.createdAt)}</p>
                      <p className="text-muted-foreground">{formatRelative(entry.createdAt)}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <p className="font-medium">{entry.actorName ?? 'System'}</p>
                      {entry.actorRole ? (
                        <p className="text-xs text-muted-foreground">{ROLE_LABELS[entry.actorRole]}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {humanise(entry.entityType)}
                    </TableCell>
                    <TableCell className="max-w-md text-sm">{entry.description}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {entry.ipAddress ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 lg:hidden">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {entry.action}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatRelative(entry.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actorName ?? 'System'}
                    {entry.actorRole ? ` · ${ROLE_LABELS[entry.actorRole]}` : ''} ·{' '}
                    {formatDateTime(entry.createdAt)}
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
