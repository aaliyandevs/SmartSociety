import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

import { ConflictError } from '@/lib/errors';
import {
  applyOverduePenalties,
  generateMonthlyBills,
  getCollectionSummary,
  getBillDetail,
  refreshOverdueStatuses,
  simulatePayment,
} from '@/services/billing-service';
import { buildReceiptPdf } from '@/services/pdf-service';
import { prisma, resetDatabase, seedBaseline, type Baseline } from '../setup/fixtures';

let baseline: Baseline;

const COMMON_CHARGES = [
  { chargeType: 'WATER' as const, label: 'Water charges', amount: 400 },
  { chargeType: 'SECURITY' as const, label: 'Security services', amount: 600 },
];

const nextMonthDue = () => new Date(Date.now() + 15 * 86_400_000);

beforeAll(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

beforeEach(async () => {
  await prisma.payment.deleteMany();
  await prisma.billCharge.deleteMany();
  await prisma.maintenanceBill.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('generating the monthly billing run', () => {
  it('creates one invoice per occupied flat with the per-flat charge added', async () => {
    const result = await generateMonthlyBills({
      periodMonth: 3,
      periodYear: 2026,
      dueDate: nextMonthDue(),
      charges: COMMON_CHARGES,
      generatedById: baseline.admin.id,
    });

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);

    // Flat A: 3000 base + 1000 common. Flat B: 4000 base + 1000 common.
    expect(result.totalBilled).toBe(9000);

    const bills = await prisma.maintenanceBill.findMany({
      include: { charges: true, flat: true },
      orderBy: { flat: { flatNumber: 'asc' } },
    });

    expect(Number(bills[0].totalAmount)).toBe(4000);
    expect(Number(bills[1].totalAmount)).toBe(5000);

    // One MAINTENANCE line plus the two common lines.
    expect(bills[0].charges).toHaveLength(3);
    expect(bills[0].charges.find((c) => c.chargeType === 'MAINTENANCE')).toBeTruthy();
  });

  it('skips flats that already have an invoice for the period, so re-running is safe', async () => {
    const input = {
      periodMonth: 4,
      periodYear: 2026,
      dueDate: nextMonthDue(),
      charges: COMMON_CHARGES,
      generatedById: baseline.admin.id,
    };

    const first = await generateMonthlyBills(input);
    const second = await generateMonthlyBills(input);

    expect(first.created).toBe(2);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(2);
    expect(second.skippedFlats).toEqual(expect.arrayContaining(['A-101', 'A-102']));

    expect(await prisma.maintenanceBill.count({ where: { periodMonth: 4 } })).toBe(2);
  });

  it('can be limited to a single block', async () => {
    const result = await generateMonthlyBills({
      periodMonth: 5,
      periodYear: 2026,
      dueDate: nextMonthDue(),
      charges: COMMON_CHARGES,
      blockId: baseline.blockId,
      generatedById: baseline.admin.id,
    });
    expect(result.created).toBe(2);
  });

  it('produces a unique, readable invoice number per flat', async () => {
    await generateMonthlyBills({
      periodMonth: 6,
      periodYear: 2026,
      dueDate: nextMonthDue(),
      charges: COMMON_CHARGES,
      generatedById: baseline.admin.id,
    });

    const bills = await prisma.maintenanceBill.findMany({ where: { periodMonth: 6 } });
    const numbers = bills.map((bill) => bill.billNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers[0]).toMatch(/^INV-202606-A10[12]$/);
  });
});

describe('payment simulation', () => {
  async function firstBill() {
    await generateMonthlyBills({
      periodMonth: 7,
      periodYear: 2026,
      dueDate: nextMonthDue(),
      charges: COMMON_CHARGES,
      generatedById: baseline.admin.id,
    });
    return prisma.maintenanceBill.findFirstOrThrow({
      where: { flatId: baseline.flatA.id, periodMonth: 7 },
    });
  }

  it('settles a bill in full and marks it PAID', async () => {
    const bill = await firstBill();
    const result = await simulatePayment({
      billId: bill.id,
      residentId: baseline.resident.residentId,
      method: 'UPI',
    });

    expect(result.amount).toBe(4000);
    expect(result.billStatus).toBe('PAID');
    expect(result.outstanding).toBe(0);
    expect(result.receiptNumber).toMatch(/^RCPT-/);
    expect(result.transactionRef).toMatch(/^TXN/);

    const updated = await prisma.maintenanceBill.findUniqueOrThrow({ where: { id: bill.id } });
    expect(updated.status).toBe('PAID');
    expect(Number(updated.paidAmount)).toBe(4000);
  });

  it('records a partial payment and leaves the balance outstanding', async () => {
    const bill = await firstBill();
    const result = await simulatePayment({
      billId: bill.id,
      residentId: baseline.resident.residentId,
      method: 'CARD',
      amount: 1500,
    });

    expect(result.amount).toBe(1500);
    expect(result.billStatus).toBe('PARTIALLY_PAID');
    expect(result.outstanding).toBe(2500);
  });

  it('never over-credits a bill when paying twice', async () => {
    const bill = await firstBill();
    await simulatePayment({
      billId: bill.id,
      residentId: baseline.resident.residentId,
      method: 'UPI',
      amount: 3000,
    });
    // Asking to pay more than the balance settles only the balance.
    const second = await simulatePayment({
      billId: bill.id,
      residentId: baseline.resident.residentId,
      method: 'UPI',
      amount: 9999,
    });

    expect(second.amount).toBe(1000);

    const updated = await prisma.maintenanceBill.findUniqueOrThrow({ where: { id: bill.id } });
    expect(Number(updated.paidAmount)).toBe(4000);
    expect(updated.status).toBe('PAID');
  });

  it('refuses to pay an already-settled bill', async () => {
    const bill = await firstBill();
    await simulatePayment({ billId: bill.id, residentId: baseline.resident.residentId, method: 'UPI' });

    await expect(
      simulatePayment({ billId: bill.id, residentId: baseline.resident.residentId, method: 'UPI' }),
    ).rejects.toThrow(ConflictError);
  });

  it('refuses to pay a cancelled bill', async () => {
    const bill = await firstBill();
    await prisma.maintenanceBill.update({ where: { id: bill.id }, data: { status: 'CANCELLED' } });

    await expect(
      simulatePayment({ billId: bill.id, residentId: baseline.resident.residentId, method: 'UPI' }),
    ).rejects.toThrow(ConflictError);
  });

  it('flags the payment as simulated with a gateway note', async () => {
    const bill = await firstBill();
    const result = await simulatePayment({
      billId: bill.id,
      residentId: baseline.resident.residentId,
      method: 'NETBANKING',
    });

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
    expect(payment.simulated).toBe(true);
    expect(payment.status).toBe('SUCCESS');
    expect(JSON.stringify(payment.gatewayResponse)).toContain('SIMULATED');
  });
});

describe('overdue handling and penalties', () => {
  async function overdueBill() {
    await generateMonthlyBills({
      periodMonth: 8,
      periodYear: 2026,
      dueDate: new Date(Date.now() - 20 * 86_400_000),
      charges: COMMON_CHARGES,
      generatedById: baseline.admin.id,
    });
    return prisma.maintenanceBill.findFirstOrThrow({
      where: { flatId: baseline.flatA.id, periodMonth: 8 },
    });
  }

  it('moves unpaid bills past their due date to OVERDUE', async () => {
    await overdueBill();
    const updated = await refreshOverdueStatuses();
    expect(updated).toBeGreaterThanOrEqual(1);

    const bill = await prisma.maintenanceBill.findFirstOrThrow({
      where: { flatId: baseline.flatA.id, periodMonth: 8 },
    });
    expect(bill.status).toBe('OVERDUE');
  });

  it('applies the society penalty once and adds a PENALTY charge line', async () => {
    const bill = await overdueBill();

    const first = await applyOverduePenalties(bill.id);
    expect(first.updated).toBe(1);
    expect(first.totalPenalty).toBe(80); // 2% of 4000

    const updated = await prisma.maintenanceBill.findUniqueOrThrow({
      where: { id: bill.id },
      include: { charges: true },
    });
    expect(Number(updated.penaltyAmount)).toBe(80);
    expect(Number(updated.totalAmount)).toBe(4080);
    expect(updated.charges.some((charge) => charge.chargeType === 'PENALTY')).toBe(true);

    // Running it again must not double-charge.
    const second = await applyOverduePenalties(bill.id);
    expect(second.updated).toBe(0);
  });

  it('leaves bills inside the grace period alone', async () => {
    await generateMonthlyBills({
      periodMonth: 9,
      periodYear: 2026,
      dueDate: new Date(Date.now() - 86_400_000), // one day overdue, grace is five
      charges: COMMON_CHARGES,
      generatedById: baseline.admin.id,
    });

    const result = await applyOverduePenalties();
    const bill = await prisma.maintenanceBill.findFirstOrThrow({
      where: { flatId: baseline.flatA.id, periodMonth: 9 },
    });
    expect(Number(bill.penaltyAmount)).toBe(0);
    expect(result.updated).toBe(0);
  });
});

describe('collection reporting', () => {
  it('aggregates billed, collected and outstanding amounts', async () => {
    await generateMonthlyBills({
      periodMonth: 10,
      periodYear: 2026,
      dueDate: nextMonthDue(),
      charges: COMMON_CHARGES,
      generatedById: baseline.admin.id,
    });

    const bill = await prisma.maintenanceBill.findFirstOrThrow({
      where: { flatId: baseline.flatA.id, periodMonth: 10 },
    });
    await simulatePayment({ billId: bill.id, residentId: baseline.resident.residentId, method: 'UPI' });

    const summary = await getCollectionSummary({ year: 2026, month: 10 });
    expect(summary.billed).toBe(9000);
    expect(summary.collected).toBe(4000);
    expect(summary.outstanding).toBe(5000);
    expect(summary.collectionRate).toBe(44);
  });
});

describe('PDF receipts', () => {
  it('renders a real PDF for a paid invoice', async () => {
    await generateMonthlyBills({
      periodMonth: 11,
      periodYear: 2026,
      dueDate: nextMonthDue(),
      charges: COMMON_CHARGES,
      generatedById: baseline.admin.id,
    });

    const bill = await prisma.maintenanceBill.findFirstOrThrow({
      where: { flatId: baseline.flatA.id, periodMonth: 11 },
    });
    const payment = await simulatePayment({
      billId: bill.id,
      residentId: baseline.resident.residentId,
      method: 'UPI',
    });

    const detail = await getBillDetail(bill.id);
    expect(detail).not.toBeNull();

    const pdf = await buildReceiptPdf({
      societyName: 'Test Society',
      societyAddress: '1 Test Road, Lahore 54000',
      societyContact: 'office@test.local · 03004000000',
      bill: detail!,
      payment: detail!.payments.find((entry) => entry.id === payment.paymentId) ?? null,
    });

    // %PDF- magic bytes.
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it('renders an invoice PDF even when nothing has been paid', async () => {
    await generateMonthlyBills({
      periodMonth: 12,
      periodYear: 2026,
      dueDate: nextMonthDue(),
      charges: COMMON_CHARGES,
      generatedById: baseline.admin.id,
    });

    const bill = await prisma.maintenanceBill.findFirstOrThrow({
      where: { flatId: baseline.flatB.id, periodMonth: 12 },
    });
    const detail = await getBillDetail(bill.id);

    const pdf = await buildReceiptPdf({
      societyName: 'Test Society',
      societyAddress: '1 Test Road, Lahore 54000',
      societyContact: 'office@test.local',
      bill: detail!,
      payment: null,
    });

    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe('%PDF-');
  });
});
