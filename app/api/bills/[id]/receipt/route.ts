import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { publicEnv } from '@/lib/env';
import { buildReceiptPdf } from '@/services/pdf-service';
import { getBillDetail } from '@/services/billing-service';
import { getSociety } from '@/services/society-service';

/**
 * Downloadable maintenance receipt / invoice (SRS §1.6, Residents #2).
 *
 * Pass `?payment=<id>` for a specific receipt; without it the most recent
 * successful payment is used, or an unpaid invoice is rendered.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bill = await getBillDetail(id);
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // A resident may only download documents for their own flat.
  if (user.role === 'RESIDENT' && bill.flatId !== user.flatId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (user.role === 'GUARD' || user.role === 'MAINTENANCE_STAFF') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requestedPaymentId = new URL(request.url).searchParams.get('payment');
  const successfulPayments = bill.payments.filter((payment) => payment.status === 'SUCCESS');
  const payment = requestedPaymentId
    ? (successfulPayments.find((entry) => entry.id === requestedPaymentId) ?? null)
    : (successfulPayments[0] ?? null);

  const society = await getSociety();

  const pdf = await buildReceiptPdf({
    societyName: society.name || publicEnv.societyName,
    societyAddress: [society.addressLine1, society.addressLine2, `${society.city} ${society.postalCode}`]
      .filter(Boolean)
      .join(', '),
    societyContact: `${society.contactEmail} · ${society.contactPhone}`,
    bill,
    payment,
  });

  const prefix = payment ? 'receipt' : 'invoice';
  const reference = payment ? payment.receiptNumber : bill.billNumber;

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${prefix}-${reference}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
