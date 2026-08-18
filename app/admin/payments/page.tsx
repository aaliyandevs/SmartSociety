import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { CreditCard, Download, Receipt, Wallet } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { Button } from '@/components/ui/button';
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
import { formatCurrency, formatDateTime, humanise } from '@/lib/utils';

export const metadata: Metadata = { title: 'Payments' };

const PAGE_SIZE = 25;

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; method?: string; status?: string; page?: string }>;
}) {
  await requireRole('ADMIN');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.PaymentWhereInput = {
    ...(params.method ? { method: params.method as Prisma.EnumPaymentMethodFilter['equals'] } : {}),
    ...(params.status ? { status: params.status as Prisma.EnumPaymentStatusFilter['equals'] } : {}),
    ...(params.q
      ? {
          OR: [
            { receiptNumber: { contains: params.q, mode: 'insensitive' } },
            { transactionRef: { contains: params.q, mode: 'insensitive' } },
            { bill: { billNumber: { contains: params.q, mode: 'insensitive' } } },
            { bill: { flat: { flatNumber: { contains: params.q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [payments, total, totals, monthTotal, byMethod] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        bill: {
          select: {
            id: true,
            billNumber: true,
            periodMonth: true,
            periodYear: true,
            flat: { select: { flatNumber: true, block: { select: { name: true } } } },
          },
        },
        resident: { include: { user: { select: { fullName: true } } } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({
      where: { status: 'SUCCESS', paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Payments ledger"
        description="Every payment recorded against a maintenance invoice, with downloadable receipts."
      />

      <Alert variant="info" hideIcon>
        Payment gateway processing and bank reconciliation are <strong>simulated</strong> for this build,
        as scoped by the requirements specification (§1.4). Receipts and transaction references are
        generated exactly as they would be with a live gateway.
      </Alert>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total collected"
          value={formatCurrency(totals._sum.amount ?? 0)}
          hint={`${totals._count} successful payments`}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="This month"
          value={formatCurrency(monthTotal._sum.amount ?? 0)}
          hint={`${monthTotal._count} payment(s)`}
          icon={CreditCard}
        />
        <StatCard
          label="Most used method"
          value={
            byMethod.length > 0
              ? humanise(
                  byMethod.reduce((best, row) => (row._count._all > best._count._all ? row : best))
                    .method,
                )
              : '—'
          }
          hint="Across all payments"
          icon={Receipt}
          tone="info"
        />
        <StatCard
          label="Average payment"
          value={
            totals._count > 0
              ? formatCurrency(Number(totals._sum.amount ?? 0) / totals._count)
              : formatCurrency(0)
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">By payment method</CardTitle>
            <CardDescription>Successful payments only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {byMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              byMethod
                .sort((a, b) => Number(b._sum.amount ?? 0) - Number(a._sum.amount ?? 0))
                .map((row) => (
                  <div key={row.method} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{humanise(row.method)}</span>
                    <span className="tabular font-medium">{formatCurrency(row._sum.amount ?? 0)}</span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <FilterBar
            searchPlaceholder="Search receipt, transaction or flat…"
            filters={[
              {
                name: 'method',
                label: 'Method',
                options: [
                  { value: 'UPI', label: 'UPI' },
                  { value: 'CARD', label: 'Card' },
                  { value: 'NETBANKING', label: 'Net banking' },
                  { value: 'WALLET', label: 'Wallet' },
                  { value: 'CASH', label: 'Cash' },
                  { value: 'CHEQUE', label: 'Cheque' },
                ],
              },
              {
                name: 'status',
                label: 'Status',
                options: [
                  { value: 'SUCCESS', label: 'Success' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'FAILED', label: 'Failed' },
                  { value: 'REFUNDED', label: 'Refunded' },
                ],
              },
            ]}
          />

          {payments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No payments match these filters"
              description="Clear the filters to see the full ledger."
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paid at</TableHead>
                      <TableHead>Flat</TableHead>
                      <TableHead>Resident</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(payment.paidAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {payment.bill.flat.block.name}-{payment.bill.flat.flatNumber}
                        </TableCell>
                        <TableCell className="text-sm">
                          {payment.resident?.user.fullName ?? (
                            <span className="text-muted-foreground">Office</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {payment.receiptNumber}
                        </TableCell>
                        <TableCell className="text-sm">{humanise(payment.method)}</TableCell>
                        <TableCell className="tabular whitespace-nowrap text-right font-medium">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={payment.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon-sm" aria-label="Download receipt">
                            <a
                              href={`/api/bills/${payment.bill.id}/receipt?payment=${payment.id}`}
                              download
                            >
                              <Download className="size-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
                {payments.map((payment) => (
                  <Card key={payment.id}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="tabular font-semibold">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            Flat {payment.bill.flat.block.name}-{payment.bill.flat.flatNumber} ·{' '}
                            {humanise(payment.method)}
                          </p>
                        </div>
                        <StatusBadge status={payment.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDateTime(payment.paidAt)}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {payment.receiptNumber}
                      </p>
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <a href={`/api/bills/${payment.bill.id}/receipt?payment=${payment.id}`} download>
                          <Download className="size-4" />
                          Receipt PDF
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <DataPagination page={page} pageSize={PAGE_SIZE} total={total} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
