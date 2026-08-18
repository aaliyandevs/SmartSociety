import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeIndianRupee, Download, FileText } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
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
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { MONTH_NAMES, formatCurrency, formatDate } from '@/lib/utils';
import { refreshOverdueStatuses } from '@/services/billing-service';

export const metadata: Metadata = { title: 'Maintenance Bills' };

export default async function ResidentBillsPage() {
  const user = await requireResident();
  await refreshOverdueStatuses();

  const [bills, totals] = await Promise.all([
    prisma.maintenanceBill.findMany({
      where: { flatId: user.flatId },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      include: { charges: true, payments: { where: { status: 'SUCCESS' }, orderBy: { paidAt: 'desc' } } },
    }),
    prisma.maintenanceBill.aggregate({
      where: { flatId: user.flatId, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
  ]);

  const billed = Number(totals._sum.totalAmount ?? 0);
  const paid = Number(totals._sum.paidAmount ?? 0);
  const outstanding = Number((billed - paid).toFixed(2));
  const overdueCount = bills.filter((bill) => bill.status === 'OVERDUE').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Flat ${user.flatLabel}`}
        title="Maintenance bills"
        description="Current and historical invoices with a full breakdown of charges."
      />

      {overdueCount > 0 ? (
        <Alert variant="destructive" title={`${overdueCount} invoice(s) are past their due date`}>
          A late-payment penalty applies after the grace period. Settle them from the list below.
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          hint={outstanding > 0 ? 'Pay from any invoice below' : 'All settled — thank you'}
          icon={BadgeIndianRupee}
          tone={outstanding > 0 ? 'warning' : 'success'}
        />
        <StatCard label="Total paid" value={formatCurrency(paid)} hint="Across all invoices" tone="success" />
        <StatCard label="Invoices" value={bills.length} hint="Raised for your flat" icon={FileText} />
      </section>

      {bills.length === 0 ? (
        <EmptyState
          icon={BadgeIndianRupee}
          title="No invoices yet"
          description="Maintenance invoices raised by the society office will appear here."
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => {
                  const due = Number(bill.totalAmount) - Number(bill.paidAmount);
                  return (
                    <TableRow key={bill.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {MONTH_NAMES[bill.periodMonth - 1]} {bill.periodYear}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {bill.billNumber}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(bill.dueDate)}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right font-medium">
                        {formatCurrency(bill.totalAmount)}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right text-sm">
                        {formatCurrency(bill.paidAmount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={bill.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/resident/bills/${bill.id}`}>
                              {due > 0 && bill.status !== 'CANCELLED' ? 'Pay' : 'View'}
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="icon-sm" aria-label="Download PDF">
                            <a href={`/api/bills/${bill.id}/receipt`} download>
                              <Download className="size-4" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {bills.map((bill) => {
              const due = Number(bill.totalAmount) - Number(bill.paidAmount);
              return (
                <Card key={bill.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {MONTH_NAMES[bill.periodMonth - 1]} {bill.periodYear}
                        </p>
                        <p className="text-xs text-muted-foreground">{bill.billNumber}</p>
                      </div>
                      <StatusBadge status={bill.status} />
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="tabular text-lg font-semibold">
                          {formatCurrency(bill.totalAmount)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Due {formatDate(bill.dueDate)}</p>
                        {due > 0 ? (
                          <p className="tabular text-sm font-medium text-warning-foreground dark:text-warning">
                            {formatCurrency(due)} outstanding
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-success">Fully paid</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button asChild className="flex-1" variant={due > 0 ? 'default' : 'outline'}>
                        <Link href={`/resident/bills/${bill.id}`}>
                          {due > 0 && bill.status !== 'CANCELLED' ? 'Pay now' : 'View breakdown'}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="icon" aria-label="Download PDF">
                        <a href={`/api/bills/${bill.id}/receipt`} download>
                          <Download className="size-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
