import 'server-only';

import { type BillStatus, type ChargeType, type PaymentMethod, Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { generateBillNumber, generateReceiptNumber, generateTransactionRef } from '@/lib/codes';
import { formatInTimeZone } from '@/lib/utils';

/**
 * Maintenance billing engine.
 *
 * SRS §1.6 (Administration #2): generate monthly invoices, apply penalties on
 * overdue balances, monitor collection reports. Payment gateway processing and
 * bank reconciliation are simulated (§1.4).
 */

const dec = (value: number | Prisma.Decimal) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value.toFixed(2));

export interface ChargeLine {
  chargeType: ChargeType;
  label: string;
  amount: number;
}

export interface GenerateBillsInput {
  periodMonth: number;
  periodYear: number;
  dueDate: Date;
  charges: ChargeLine[];
  blockId?: string | null;
  notes?: string | null;
  generatedById: string;
}

export interface GenerateBillsResult {
  created: number;
  skipped: number;
  totalBilled: number;
  skippedFlats: string[];
}

/**
 * Creates one invoice per *occupied* flat for the given period.
 *
 * Flats that already have an invoice for the period are skipped rather than
 * duplicated — the composite unique key on (flatId, periodYear, periodMonth)
 * makes that a hard guarantee, and re-running a billing run is therefore safe.
 */
export async function generateMonthlyBills(input: GenerateBillsInput): Promise<GenerateBillsResult> {
  const flats = await prisma.flat.findMany({
    where: {
      deletedAt: null,
      occupancyStatus: 'OCCUPIED',
      ...(input.blockId ? { blockId: input.blockId } : {}),
      // Only bill flats that actually have a resident on record.
      residents: { some: { deletedAt: null } },
    },
    select: {
      id: true,
      flatNumber: true,
      baseMaintenance: true,
      block: { select: { name: true } },
      bills: {
        where: { periodMonth: input.periodMonth, periodYear: input.periodYear },
        select: { id: true },
      },
    },
    orderBy: [{ block: { name: 'asc' } }, { flatNumber: 'asc' }],
  });

  if (flats.length === 0) {
    throw new AppError(
      'There are no occupied flats to bill. Add residents to flats before generating invoices.',
    );
  }

  const commonTotal = input.charges.reduce((sum, charge) => sum + charge.amount, 0);
  const issueDate = new Date();

  let created = 0;
  let totalBilled = 0;
  const skippedFlats: string[] = [];

  for (const flat of flats) {
    const label = `${flat.block.name}-${flat.flatNumber}`;
    if (flat.bills.length > 0) {
      skippedFlats.push(label);
      continue;
    }

    const base = Number(flat.baseMaintenance);
    const baseAmount = base + commonTotal;

    await prisma.maintenanceBill.create({
      data: {
        billNumber: generateBillNumber(
          input.periodYear,
          input.periodMonth,
          `${flat.block.name}${flat.flatNumber}`,
        ),
        flatId: flat.id,
        periodMonth: input.periodMonth,
        periodYear: input.periodYear,
        issueDate,
        dueDate: input.dueDate,
        baseAmount: dec(baseAmount),
        totalAmount: dec(baseAmount),
        status: 'UNPAID',
        notes: input.notes ?? null,
        generatedById: input.generatedById,
        charges: {
          create: [
            {
              chargeType: 'MAINTENANCE',
              label: 'Monthly maintenance',
              amount: dec(base),
            },
            ...input.charges.map((charge) => ({
              chargeType: charge.chargeType,
              label: charge.label,
              amount: dec(charge.amount),
            })),
          ],
        },
      },
    });

    created += 1;
    totalBilled += baseAmount;
  }

  return { created, skipped: skippedFlats.length, totalBilled, skippedFlats };
}

/**
 * Applies the society's late-payment penalty to every bill that is past its due
 * date plus the grace period and has not already been penalised.
 */
export async function applyOverduePenalties(billId?: string | null): Promise<{
  updated: number;
  totalPenalty: number;
}> {
  const society = await prisma.society.findFirst({
    select: { penaltyPercent: true, penaltyGraceDays: true },
  });
  const percent = Number(society?.penaltyPercent ?? 2);
  const graceDays = society?.penaltyGraceDays ?? 5;
  const cutoff = new Date(Date.now() - graceDays * 86_400_000);

  const bills = await prisma.maintenanceBill.findMany({
    where: {
      ...(billId ? { id: billId } : {}),
      status: { in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] },
      dueDate: { lt: cutoff },
      penaltyAmount: { equals: 0 },
    },
    select: { id: true, baseAmount: true, paidAmount: true },
  });

  let totalPenalty = 0;

  for (const bill of bills) {
    const penalty = Number((Number(bill.baseAmount) * (percent / 100)).toFixed(2));
    const newTotal = Number(bill.baseAmount) + penalty;

    await prisma.$transaction([
      prisma.maintenanceBill.update({
        where: { id: bill.id },
        data: {
          penaltyAmount: dec(penalty),
          totalAmount: dec(newTotal),
          status: 'OVERDUE',
        },
      }),
      prisma.billCharge.create({
        data: {
          billId: bill.id,
          chargeType: 'PENALTY',
          label: `Late payment penalty (${percent}%)`,
          amount: dec(penalty),
        },
      }),
    ]);

    totalPenalty += penalty;
  }

  return { updated: bills.length, totalPenalty };
}

/** Moves unpaid bills past their due date into the OVERDUE state. */
export async function refreshOverdueStatuses(): Promise<number> {
  const result = await prisma.maintenanceBill.updateMany({
    where: { status: 'UNPAID', dueDate: { lt: new Date() } },
    data: { status: 'OVERDUE' },
  });
  return result.count;
}

// ── Payment simulation ────────────────────────────────────────────────────────

export interface SimulatePaymentInput {
  billId: string;
  /** Null for an administrator recording an offline payment. */
  residentId: string | null;
  method: PaymentMethod;
  /** Omit to settle the full outstanding balance. */
  amount?: number | null;
}

export interface PaymentResult {
  paymentId: string;
  receiptNumber: string;
  transactionRef: string;
  amount: number;
  billStatus: BillStatus;
  outstanding: number;
}

/**
 * Simulated payment.
 *
 * The SRS scopes real gateway and bank reconciliation out (§1.4), so this
 * records a SUCCESS payment against a synthetic transaction reference. The
 * bill's paid amount and status are recalculated inside one transaction so a
 * double submit can never over-credit a bill.
 */
export async function simulatePayment(input: SimulatePaymentInput): Promise<PaymentResult> {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.maintenanceBill.findUnique({
      where: { id: input.billId },
      select: {
        id: true,
        totalAmount: true,
        paidAmount: true,
        status: true,
        flatId: true,
        billNumber: true,
      },
    });

    if (!bill) throw new NotFoundError('That invoice could not be found.');
    if (bill.status === 'CANCELLED') throw new ConflictError('This invoice has been cancelled.');
    if (bill.status === 'PAID') throw new ConflictError('This invoice is already fully paid.');

    const outstanding = Number(bill.totalAmount) - Number(bill.paidAmount);
    if (outstanding <= 0) throw new ConflictError('This invoice has no outstanding balance.');

    const amount = input.amount && input.amount > 0 ? input.amount : outstanding;
    if (amount <= 0) {
      throw new AppError('Enter an amount greater than zero.', {
        fieldErrors: { amount: ['Enter an amount greater than zero.'] },
      });
    }
    // Reject an overpayment outright rather than silently rewriting it down
    // to the outstanding balance — someone who fat-fingers an extra digit
    // deserves to be told, not charged a different number than they typed.
    if (amount - outstanding > 0.009) {
      throw new AppError(
        `That's more than the outstanding balance of Rs ${outstanding.toFixed(2)}.`,
        { fieldErrors: { amount: [`Cannot exceed the outstanding balance of Rs ${outstanding.toFixed(2)}.`] } },
      );
    }

    const newPaid = Number((Number(bill.paidAmount) + amount).toFixed(2));
    const remaining = Number((Number(bill.totalAmount) - newPaid).toFixed(2));
    const status: BillStatus = remaining <= 0.009 ? 'PAID' : 'PARTIALLY_PAID';

    const payment = await tx.payment.create({
      data: {
        billId: bill.id,
        residentId: input.residentId,
        receiptNumber: generateReceiptNumber(),
        transactionRef: generateTransactionRef(),
        amount: dec(amount),
        method: input.method,
        status: 'SUCCESS',
        simulated: true,
        gatewayResponse: {
          gateway: 'SIMULATED',
          note: 'Payment gateway processing and bank reconciliation are simulated (SRS §1.4).',
          capturedAt: new Date().toISOString(),
        },
      },
      select: { id: true, receiptNumber: true, transactionRef: true },
    });

    await tx.maintenanceBill.update({
      where: { id: bill.id },
      data: { paidAmount: dec(newPaid), status },
    });

    return {
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
      transactionRef: payment.transactionRef,
      amount,
      billStatus: status,
      outstanding: Math.max(0, remaining),
    };
  });
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export const billDetailInclude = {
  charges: { orderBy: { amount: 'desc' } },
  payments: { orderBy: { paidAt: 'desc' } },
  flat: {
    include: {
      block: true,
      residents: {
        where: { deletedAt: null },
        include: { user: { select: { fullName: true, email: true, phone: true } } },
        orderBy: { isPrimary: 'desc' },
      },
    },
  },
} satisfies Prisma.MaintenanceBillInclude;

export type BillDetail = Prisma.MaintenanceBillGetPayload<{ include: typeof billDetailInclude }>;

export async function getBillDetail(billId: string): Promise<BillDetail | null> {
  return prisma.maintenanceBill.findUnique({ where: { id: billId }, include: billDetailInclude });
}

/** Aggregate figures for the admin billing dashboard and collection report. */
export async function getCollectionSummary(options: { year?: number; month?: number } = {}) {
  const where: Prisma.MaintenanceBillWhereInput = {
    status: { not: 'CANCELLED' },
    ...(options.year ? { periodYear: options.year } : {}),
    ...(options.month ? { periodMonth: options.month } : {}),
  };

  const [totals, byStatus] = await Promise.all([
    prisma.maintenanceBill.aggregate({
      where,
      _sum: { totalAmount: true, paidAmount: true, penaltyAmount: true },
      _count: true,
    }),
    prisma.maintenanceBill.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true, paidAmount: true },
    }),
  ]);

  const billed = Number(totals._sum.totalAmount ?? 0);
  const collected = Number(totals._sum.paidAmount ?? 0);

  return {
    billCount: totals._count,
    billed,
    collected,
    outstanding: Number((billed - collected).toFixed(2)),
    penalties: Number(totals._sum.penaltyAmount ?? 0),
    collectionRate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
    byStatus: byStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
      billed: Number(row._sum.totalAmount ?? 0),
      collected: Number(row._sum.paidAmount ?? 0),
    })),
  };
}

/** Last N months of billed-vs-collected figures, for the admin chart. */
export async function getMonthlyCollectionTrend(months = 6) {
  const now = new Date();
  const periods: { year: number; month: number }[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
  }

  const rows = await prisma.maintenanceBill.groupBy({
    by: ['periodYear', 'periodMonth'],
    where: {
      status: { not: 'CANCELLED' },
      OR: periods.map((period) => ({ periodYear: period.year, periodMonth: period.month })),
    },
    _sum: { totalAmount: true, paidAmount: true },
  });

  const lookup = new Map(
    rows.map((row) => [
      `${row.periodYear}-${row.periodMonth}`,
      { billed: Number(row._sum.totalAmount ?? 0), collected: Number(row._sum.paidAmount ?? 0) },
    ]),
  );

  return periods.map((period) => {
    const entry = lookup.get(`${period.year}-${period.month}`) ?? { billed: 0, collected: 0 };
    return {
      label: formatInTimeZone(new Date(Date.UTC(period.year, period.month - 1, 1)), {
        month: 'short',
      }),
      year: period.year,
      month: period.month,
      billed: entry.billed,
      collected: entry.collected,
      outstanding: Number((entry.billed - entry.collected).toFixed(2)),
    };
  });
}
