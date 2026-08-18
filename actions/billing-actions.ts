'use server';

import { revalidatePath } from 'next/cache';

import { type ActionState, runAction, success } from '@/lib/action-result';
import { AUDIT_ACTIONS, auditActor, recordAudit } from '@/lib/audit';
import { requireRole } from '@/lib/auth/session';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { notifyFlat } from '@/lib/notifications';
import prisma from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rate-limit';
import { formatCurrency } from '@/lib/utils';
import {
  applyPenaltiesSchema,
  generateBillsSchema,
  paymentSchema,
} from '@/lib/validations/billing';
import {
  applyOverduePenalties,
  generateMonthlyBills,
  simulatePayment,
} from '@/services/billing-service';

/**
 * Billing engine actions.
 *
 * Anything that touches money is written to the audit log — the NFR calls for
 * immutable records of "admin financial edits".
 */

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

/** Parses the repeated charge rows posted by the bill-generation form. */
function parseCharges(formData: FormData) {
  const types = formData.getAll('chargeType').map(String);
  const labels = formData.getAll('chargeLabel').map(String);
  const amounts = formData.getAll('chargeAmount').map(String);

  return types
    .map((chargeType, index) => ({
      chargeType,
      label: labels[index] ?? '',
      amount: amounts[index] ?? '0',
    }))
    .filter((row) => row.label.trim().length > 0 && Number(row.amount) > 0);
}

export async function generateBillsAction(
  _prev: ActionState<{ created: number }>,
  formData: FormData,
): Promise<ActionState<{ created: number }>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    enforceRateLimit(`bills:generate:${user.id}`, 5, 300);

    const input = generateBillsSchema.parse({
      periodMonth: formValue(formData, 'periodMonth'),
      periodYear: formValue(formData, 'periodYear'),
      dueDate: formValue(formData, 'dueDate'),
      charges: parseCharges(formData),
      blockId: formValue(formData, 'blockId') ?? '',
      notes: formValue(formData, 'notes'),
    });

    const result = await generateMonthlyBills({
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      dueDate: input.dueDate,
      charges: input.charges,
      blockId: input.blockId || null,
      notes: input.notes,
      generatedById: user.id,
    });

    const period = new Date(input.periodYear, input.periodMonth - 1, 1).toLocaleDateString('en-PK', {
      month: 'long',
      year: 'numeric',
    });

    await recordAudit({
      action: AUDIT_ACTIONS.BILL_GENERATED,
      entityType: 'MaintenanceBill',
      description: `Generated ${result.created} maintenance invoice(s) for ${period} totalling ${formatCurrency(result.totalBilled)}.`,
      metadata: {
        period,
        created: result.created,
        skipped: result.skipped,
        totalBilled: result.totalBilled,
      },
      actor: auditActor(user),
    });

    // Tell each billed flat that their invoice is ready.
    if (result.created > 0) {
      const bills = await prisma.maintenanceBill.findMany({
        where: { periodMonth: input.periodMonth, periodYear: input.periodYear },
        select: { id: true, flatId: true, billNumber: true, totalAmount: true, dueDate: true },
      });

      await Promise.all(
        bills.map((bill) =>
          notifyFlat(bill.flatId, {
            type: 'BILL_GENERATED',
            title: `Maintenance bill for ${period}`,
            body: `Invoice ${bill.billNumber} for ${formatCurrency(Number(bill.totalAmount))} is due on ${bill.dueDate.toLocaleDateString('en-PK')}.`,
            link: '/resident/bills',
            entityType: 'MaintenanceBill',
            entityId: bill.id,
          }),
        ),
      );
    }

    revalidatePath('/admin/bills');
    revalidatePath('/admin');

    const message =
      result.skipped > 0
        ? `Generated ${result.created} invoice(s). ${result.skipped} flat(s) already had a bill for ${period} and were skipped.`
        : `Generated ${result.created} invoice(s) for ${period}, totalling ${formatCurrency(result.totalBilled)}.`;

    return success(message, { created: result.created });
  });
}

export async function applyPenaltiesAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const input = applyPenaltiesSchema.parse({ billId: formValue(formData, 'billId') ?? '' });

    const result = await applyOverduePenalties(input.billId || null);

    await recordAudit({
      action: AUDIT_ACTIONS.PENALTY_APPLIED,
      entityType: 'MaintenanceBill',
      entityId: input.billId || null,
      description: `Applied late-payment penalties to ${result.updated} invoice(s), totalling ${formatCurrency(result.totalPenalty)}.`,
      metadata: { updated: result.updated, totalPenalty: result.totalPenalty },
      actor: auditActor(user),
    });

    revalidatePath('/admin/bills');

    return success(
      result.updated === 0
        ? 'No invoices were eligible for a penalty right now.'
        : `Penalty applied to ${result.updated} invoice(s) — ${formatCurrency(result.totalPenalty)} added.`,
    );
  });
}

export async function simulatePaymentAction(
  _prev: ActionState<{ paymentId: string; receiptNumber: string }>,
  formData: FormData,
): Promise<ActionState<{ paymentId: string; receiptNumber: string }>> {
  return runAction(async () => {
    const user = await requireRole('RESIDENT', 'ADMIN');
    enforceRateLimit(`payment:${user.id}`, 12, 300);

    const input = paymentSchema.parse({
      billId: formValue(formData, 'billId'),
      method: formValue(formData, 'method'),
      amount: formValue(formData, 'amount') ?? '',
    });

    // A resident may only pay a bill raised against their own flat.
    const bill = await prisma.maintenanceBill.findUnique({
      where: { id: input.billId },
      select: { id: true, flatId: true, billNumber: true },
    });
    if (!bill) throw new NotFoundError('That invoice could not be found.');
    if (user.role === 'RESIDENT' && bill.flatId !== user.flatId) {
      throw new ForbiddenError('You can only pay invoices raised against your own flat.');
    }

    const result = await simulatePayment({
      billId: input.billId,
      residentId: user.role === 'RESIDENT' ? user.residentId : null,
      method: input.method,
      amount: typeof input.amount === 'number' ? input.amount : null,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.PAYMENT_SIMULATED,
      entityType: 'Payment',
      entityId: result.paymentId,
      description: `Simulated ${input.method} payment of ${formatCurrency(result.amount)} against invoice ${bill.billNumber}. Receipt ${result.receiptNumber}.`,
      metadata: {
        billNumber: bill.billNumber,
        amount: result.amount,
        method: input.method,
        receiptNumber: result.receiptNumber,
        simulated: true,
      },
      actor: auditActor(user),
    });

    await notifyFlat(bill.flatId, {
      type: 'PAYMENT_SUCCESS',
      title: 'Payment received',
      body: `${formatCurrency(result.amount)} received against invoice ${bill.billNumber}. Receipt ${result.receiptNumber} is ready to download.`,
      link: '/resident/payments',
      entityType: 'Payment',
      entityId: result.paymentId,
    });

    revalidatePath('/resident/bills');
    revalidatePath('/resident/payments');
    revalidatePath('/resident');
    revalidatePath('/admin/bills');
    revalidatePath('/admin/payments');

    return success(
      result.billStatus === 'PAID'
        ? `Payment successful. Invoice ${bill.billNumber} is now fully settled.`
        : `Payment successful. ${formatCurrency(result.outstanding)} remains outstanding on ${bill.billNumber}.`,
      { paymentId: result.paymentId, receiptNumber: result.receiptNumber },
    );
  });
}

export async function cancelBillAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const billId = formValue(formData, 'billId') ?? '';
    const reason = formValue(formData, 'reason') ?? 'Cancelled by the society office.';

    const bill = await prisma.maintenanceBill.findUnique({
      where: { id: billId },
      select: { id: true, billNumber: true, status: true, paidAmount: true },
    });
    if (!bill) throw new NotFoundError('That invoice could not be found.');

    if (Number(bill.paidAmount) > 0) {
      return {
        status: 'error' as const,
        message: 'This invoice already has a payment against it and cannot be cancelled.',
      };
    }

    await prisma.maintenanceBill.update({
      where: { id: bill.id },
      data: { status: 'CANCELLED', notes: reason },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.BILL_CANCELLED,
      entityType: 'MaintenanceBill',
      entityId: bill.id,
      description: `Cancelled invoice ${bill.billNumber}. Reason: ${reason}`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/bills');
    return success(`Invoice ${bill.billNumber} cancelled.`);
  });
}
