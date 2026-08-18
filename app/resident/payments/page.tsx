import type { Metadata } from 'next';
import { CreditCard, Download, Receipt } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
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
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { MONTH_NAMES, formatCurrency, formatDateTime, humanise } from '@/lib/utils';

export const metadata: Metadata = { title: 'Payment History' };

export default async function ResidentPaymentsPage() {
  const user = await requireResident();

  const [payments, totals] = await Promise.all([
    prisma.payment.findMany({
      where: { bill: { flatId: user.flatId } },
      orderBy: { paidAt: 'desc' },
      include: { bill: { select: { id: true, billNumber: true, periodMonth: true, periodYear: true } } },
    }),
    prisma.payment.aggregate({
      where: { bill: { flatId: user.flatId }, status: 'SUCCESS' },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const thisYear = payments.filter(
    (payment) => payment.status === 'SUCCESS' && payment.paidAt.getFullYear() === new Date().getFullYear(),
  );
  const thisYearTotal = thisYear.reduce((sum, payment) => sum + Number(payment.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Flat ${user.flatLabel}`}
        title="Payment history"
        description="Every payment recorded against your flat, with downloadable receipts."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total paid"
          value={formatCurrency(totals._sum.amount ?? 0)}
          hint={`${totals._count} payment(s)`}
          icon={CreditCard}
          tone="success"
        />
        <StatCard
          label={`Paid in ${new Date().getFullYear()}`}
          value={formatCurrency(thisYearTotal)}
          hint={`${thisYear.length} payment(s) this year`}
          icon={Receipt}
        />
        <StatCard
          label="Last payment"
          value={payments[0] ? formatCurrency(payments[0].amount) : '—'}
          hint={payments[0] ? formatDateTime(payments[0].paidAt) : 'No payments yet'}
        />
      </section>

      {payments.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No payments yet"
          description="Once you settle an invoice, the payment and its receipt will be listed here."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Receipt</TableHead>
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
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {payment.bill.billNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {MONTH_NAMES[payment.bill.periodMonth - 1]} {payment.bill.periodYear}
                    </TableCell>
                    <TableCell className="text-sm">{humanise(payment.method)}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {payment.receiptNumber}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon-sm" aria-label="Download receipt">
                        <a href={`/api/bills/${payment.bill.id}/receipt?payment=${payment.id}`} download>
                          <Download className="size-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="tabular text-lg font-semibold">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {MONTH_NAMES[payment.bill.periodMonth - 1]} {payment.bill.periodYear} ·{' '}
                        {humanise(payment.method)}
                      </p>
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDateTime(payment.paidAt)}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{payment.receiptNumber}</p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <a href={`/api/bills/${payment.bill.id}/receipt?payment=${payment.id}`} download>
                      <Download className="size-4" />
                      Download receipt
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
