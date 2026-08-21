import { z } from 'zod';

import { cuidSchema, dateSchema, moneySchema, optionalText } from '@/lib/validations/common';
import { startOfZonedDay } from '@/lib/timezone';

export const chargeTypeSchema = z.enum([
  'MAINTENANCE',
  'WATER',
  'SECURITY',
  'REPAIRS',
  'COMMON_ELECTRICITY',
  'SINKING_FUND',
  'PARKING',
  'PENALTY',
  'OTHER',
]);

export const chargeLineSchema = z.object({
  chargeType: chargeTypeSchema,
  label: z.string().trim().min(2, 'Describe the charge').max(60),
  amount: moneySchema,
});

/** Admin generates one billing run for a whole month. */
export const generateBillsSchema = z
  .object({
    periodMonth: z.coerce.number().int().min(1).max(12),
    periodYear: z.coerce.number().int().min(2020).max(2100),
    dueDate: dateSchema,
    /**
     * Charges applied to every flat. The per-flat base maintenance charge is
     * added automatically from `Flat.baseMaintenance`.
     */
    charges: z.array(chargeLineSchema).min(1, 'Add at least one charge line').max(12),
    blockId: z.union([cuidSchema, z.literal('')]).optional(),
    notes: optionalText(300),
  })
  .refine((data) => data.dueDate.getTime() >= startOfZonedDay(new Date()).getTime(), {
    // A billing run's whole point is to invoice residents going forward — a
    // due date already in the past would make every invoice it creates
    // instantly overdue.
    message: 'The due date cannot be in the past',
    path: ['dueDate'],
  });

export type GenerateBillsInput = z.infer<typeof generateBillsSchema>;

export const billAdjustSchema = z.object({
  billId: cuidSchema,
  dueDate: dateSchema,
  notes: optionalText(300),
  charges: z.array(chargeLineSchema).min(1, 'A bill needs at least one charge line').max(12),
});

export const applyPenaltiesSchema = z.object({
  /** Blank applies to every overdue bill. */
  billId: z.union([cuidSchema, z.literal('')]).optional(),
});

export const paymentSchema = z.object({
  billId: cuidSchema,
  method: z.enum(['UPI', 'CARD', 'NETBANKING', 'WALLET', 'CASH', 'CHEQUE']),
  /** Blank pays the full outstanding balance. */
  amount: z.union([moneySchema, z.literal('')]).optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
