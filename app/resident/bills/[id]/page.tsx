import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, Receipt } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { PaymentPanel } from '@/app/resident/bills/[id]/payment-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Separator } from '@/components/ui/misc';
import { requireResident } from '@/lib/auth/session';
import { MONTH_NAMES, formatCurrency, formatDate, formatDateTime, humanise } from '@/lib/utils';
import { getBillDetail } from '@/services/billing-service';

export const metadata: Metadata = { title: 'Bill Details' };

export default async function ResidentBillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireResident();

  const bill = await getBillDetail(id);
  // A resident may only open invoices raised against their own flat.
  if (!bill || bill.flatId !== user.flatId) notFound();

  const total = Number(bill.totalAmount);
  const paid = Number(bill.paidAmount);
  const outstanding = Number((total - paid).toFixed(2));
  const period = `${MONTH_NAMES[bill.periodMonth - 1]} ${bill.periodYear}`;
  const successfulPayments = bill.payments.filter((payment) => payment.status === 'SUCCESS');

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/resident/bills">
          <ArrowLeft className="size-4" />
          Back to bills
        </Link>
      </Button>

      <PageHeader
        eyebrow={bill.billNumber}
        title={`Maintenance bill — ${period}`}
        description={`Flat ${bill.flat.block.name}-${bill.flat.flatNumber} · issued ${formatDate(bill.issueDate)} · due ${formatDate(bill.dueDate)}`}
        actions={
          <>
            <StatusBadge status={bill.status} />
            <Button asChild variant="outline">
              <a href={`/api/bills/${bill.id}/receipt`} download>
                <Download className="size-4" />
                {successfulPayments.length > 0 ? 'Download receipt' : 'Download invoice'}
              </a>
            </Button>
          </>
        }
      />

      {bill.status === 'OVERDUE' ? (
        <Alert variant="destructive" title="This invoice is past its due date">
          A late-payment penalty of {formatCurrency(bill.penaltyAmount)} has been added. Please settle it to
          avoid further charges.
        </Alert>
      ) : null}
      {bill.status === 'CANCELLED' ? (
        <Alert variant="warning" title="This invoice has been cancelled">
          {bill.notes ?? 'No payment is required against it.'}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Breakdown ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Charge breakdown</CardTitle>
            <CardDescription>
              Every component of this invoice, as approved by the managing committee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {bill.charges.map((charge) => (
                <li key={charge.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{charge.label}</p>
                    <p className="text-xs text-muted-foreground">{humanise(charge.chargeType)}</p>
                  </div>
                  <p className="tabular shrink-0 text-sm font-medium">
                    {formatCurrency(charge.amount)}
                  </p>
                </li>
              ))}
            </ul>

            <Separator className="my-4" />

            <dl className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Sub-total</dt>
                <dd className="tabular font-medium">{formatCurrency(bill.baseAmount)}</dd>
              </div>
              {Number(bill.penaltyAmount) > 0 ? (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">Late payment penalty</dt>
                  <dd className="tabular font-medium text-destructive">
                    {formatCurrency(bill.penaltyAmount)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2.5 text-base">
                <dt className="font-semibold">Total payable</dt>
                <dd className="tabular font-semibold">{formatCurrency(total)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Amount paid</dt>
                <dd className="tabular font-medium text-success">{formatCurrency(paid)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2.5">
                <dt className="font-semibold">Balance due</dt>
                <dd
                  className={`tabular font-semibold ${outstanding > 0 ? 'text-warning-foreground dark:text-warning' : 'text-success'}`}
                >
                  {formatCurrency(outstanding)}
                </dd>
              </div>
            </dl>

            {bill.notes ? (
              <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{bill.notes}</p>
            ) : null}
          </CardContent>
        </Card>

        {/* ── Pay + receipts ── */}
        <div className="space-y-6">
          {outstanding > 0 && bill.status !== 'CANCELLED' ? (
            <PaymentPanel billId={bill.id} outstanding={outstanding} billNumber={bill.billNumber} />
          ) : (
            <Card className="border-success/40">
              <CardHeader>
                <CardTitle className="text-success">Fully settled</CardTitle>
                <CardDescription>
                  Nothing further is due on this invoice. Download the receipt for your records.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <a href={`/api/bills/${bill.id}/receipt`} download>
                    <Download className="size-4" />
                    Download receipt
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Receipt className="size-4 text-muted-foreground" aria-hidden />
                Payments against this invoice
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {successfulPayments.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No payment recorded yet.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {successfulPayments.map((payment) => (
                    <li key={payment.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="tabular font-medium">{formatCurrency(payment.amount)}</p>
                        <StatusBadge status={payment.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {humanise(payment.method)} · {formatDateTime(payment.paidAt)}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {payment.receiptNumber}
                      </p>
                      <Button asChild variant="ghost" size="sm" className="mt-1.5 h-7 px-2 text-xs">
                        <a href={`/api/bills/${bill.id}/receipt?payment=${payment.id}`} download>
                          <Download className="size-3.5" />
                          Receipt PDF
                        </a>
                      </Button>
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
