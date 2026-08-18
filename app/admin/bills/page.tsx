import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { BadgeIndianRupee, Download, FileWarning, TrendingUp, Wallet } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { BillingRunDialog, ApplyPenaltiesButton } from '@/app/admin/bills/billing-controls';
import { Button } from '@/components/ui/button';
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
import { MONTH_NAMES, formatCurrency, formatDate } from '@/lib/utils';
import { getCollectionSummary, refreshOverdueStatuses } from '@/services/billing-service';

export const metadata: Metadata = { title: 'Maintenance Bills' };

const PAGE_SIZE = 20;

export default async function AdminBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; block?: string; period?: string; page?: string }>;
}) {
  await requireRole('ADMIN');
  await refreshOverdueStatuses();

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [periodYear, periodMonth] = (params.period ?? '').split('-').map(Number);

  const where: Prisma.MaintenanceBillWhereInput = {
    ...(params.status ? { status: params.status as Prisma.EnumBillStatusFilter['equals'] } : {}),
    ...(params.block ? { flat: { blockId: params.block } } : {}),
    ...(periodYear && periodMonth ? { periodYear, periodMonth } : {}),
    ...(params.q
      ? {
          OR: [
            { billNumber: { contains: params.q, mode: 'insensitive' } },
            { flat: { flatNumber: { contains: params.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [bills, total, summary, blocks, periods] = await Promise.all([
    prisma.maintenanceBill.findMany({
      where,
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { flat: { flatNumber: 'asc' } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        flat: {
          include: {
            block: true,
            residents: {
              where: { deletedAt: null, isPrimary: true },
              take: 1,
              include: { user: { select: { fullName: true } } },
            },
          },
        },
      },
    }),
    prisma.maintenanceBill.count({ where }),
    getCollectionSummary(),
    prisma.block.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.maintenanceBill.groupBy({
      by: ['periodYear', 'periodMonth'],
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      take: 12,
    }),
  ]);

  const overdueCount = summary.byStatus.find((row) => row.status === 'OVERDUE')?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Maintenance bills"
        description="Run the monthly billing cycle, apply penalties and track collection."
        actions={
          <>
            <ApplyPenaltiesButton />
            <BillingRunDialog
              blocks={blocks.map((block) => ({ id: block.id, name: block.name }))}
            />
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total billed"
          value={formatCurrency(summary.billed)}
          hint={`${summary.billCount} invoices`}
          icon={BadgeIndianRupee}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(summary.collected)}
          hint={`${summary.collectionRate}% collection rate`}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(summary.outstanding)}
          hint={`${overdueCount} invoice(s) overdue`}
          icon={FileWarning}
          tone={summary.outstanding > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Penalties levied"
          value={formatCurrency(summary.penalties)}
          hint="Late-payment charges"
          icon={TrendingUp}
          tone={summary.penalties > 0 ? 'destructive' : 'default'}
        />
      </section>

      {overdueCount > 0 ? (
        <Alert variant="warning" title={`${overdueCount} invoice(s) are past their due date`}>
          Run <strong>Apply penalties</strong> to add the society&apos;s late-payment charge to every
          eligible invoice. Each application is recorded in the audit log.
        </Alert>
      ) : null}

      <FilterBar
        searchPlaceholder="Search invoice number or flat…"
        filters={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'UNPAID', label: 'Unpaid' },
              { value: 'PARTIALLY_PAID', label: 'Partially paid' },
              { value: 'PAID', label: 'Paid' },
              { value: 'OVERDUE', label: 'Overdue' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ],
          },
          {
            name: 'block',
            label: 'Block',
            options: blocks.map((block) => ({ value: block.id, label: `Block ${block.name}` })),
          },
          {
            name: 'period',
            label: 'Period',
            options: periods.map((period) => ({
              value: `${period.periodYear}-${period.periodMonth}`,
              label: `${MONTH_NAMES[period.periodMonth - 1]} ${period.periodYear}`,
            })),
          },
        ]}
      />

      {bills.length === 0 ? (
        <EmptyState
          icon={BadgeIndianRupee}
          title="No invoices match these filters"
          description="Clear the filters, or generate the billing run for a new month."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Flat</TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => {
                  const balance = Number(bill.totalAmount) - Number(bill.paidAmount);
                  return (
                    <TableRow key={bill.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {bill.billNumber}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {bill.flat.block.name}-{bill.flat.flatNumber}
                      </TableCell>
                      <TableCell className="text-sm">
                        {bill.flat.residents[0]?.user.fullName ?? (
                          <span className="text-muted-foreground">Vacant</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {MONTH_NAMES[bill.periodMonth - 1]} {bill.periodYear}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(bill.dueDate)}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right">
                        {formatCurrency(bill.totalAmount)}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right font-medium">
                        {balance > 0 ? formatCurrency(balance) : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={bill.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="icon-sm" aria-label="Download invoice">
                          <a href={`/api/bills/${bill.id}/receipt`} download>
                            <Download className="size-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {bills.map((bill) => {
              const balance = Number(bill.totalAmount) - Number(bill.paidAmount);
              return (
                <Card key={bill.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          Flat {bill.flat.block.name}-{bill.flat.flatNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {MONTH_NAMES[bill.periodMonth - 1]} {bill.periodYear} · {bill.billNumber}
                        </p>
                      </div>
                      <StatusBadge status={bill.status} />
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <p className="tabular text-lg font-semibold">{formatCurrency(bill.totalAmount)}</p>
                      <p className="text-right text-xs text-muted-foreground">
                        Due {formatDate(bill.dueDate)}
                        {balance > 0 ? (
                          <span className="block font-medium text-warning-foreground dark:text-warning">
                            {formatCurrency(balance)} outstanding
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <a href={`/api/bills/${bill.id}/receipt`} download>
                        <Download className="size-4" />
                        Download PDF
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DataPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Looking for individual payments?{' '}
        <Link href="/admin/payments" className="text-primary hover:underline">
          Open the payments ledger
        </Link>
        .
      </p>
    </div>
  );
}
