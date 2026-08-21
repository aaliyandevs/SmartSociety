import { z } from 'zod';

import { zonedTimeToUtc } from '@/lib/timezone';

/** Shared primitives so validation messages stay consistent across every form. */

export const cuidSchema = z.string().min(1, 'Required').max(64);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^03\d{9}$/, 'Enter a valid 11-digit Pakistani mobile number, e.g. 03001234567');

export const optionalPhoneSchema = z
  .union([phoneSchema, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Must be at least 2 characters')
  .max(80, 'Must be 80 characters or fewer');

/** Pakistani vehicle plate, e.g. "LEA-1234" or "LEA 1234". */
export const vehicleNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .pipe(
    z.string().regex(/^[A-Z]{2,3}\d{2,4}$/, 'Enter a valid registration number, e.g. LEA1234'),
  );

export const optionalVehicleNumberSchema = z
  .union([vehicleNumberSchema, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Turns "2026-03-18T14:30" (datetime-local) or an ISO string into a Date.
 *
 * A bare datetime-local value has no timezone of its own — it's read as a
 * wall-clock time in the society's own timezone (see `lib/timezone.ts`),
 * not whatever zone the server process happens to be running in.
 */
export const dateTimeSchema = z
  .union([z.string().min(1), z.date()])
  .transform((value, ctx) => {
    const date = value instanceof Date ? value : zonedTimeToUtc(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date and time' });
      return z.NEVER;
    }
    return date;
  });

/** Same as `dateTimeSchema`, but an empty input becomes `null`. */
export const optionalDateTimeSchema = z
  .union([z.literal(''), z.null(), z.undefined(), dateTimeSchema])
  .transform((value) => (value === '' || value === undefined ? null : value));

export const dateSchema = z.union([z.string().min(1), z.date()]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date' });
    return z.NEVER;
  }
  return date;
});

export const moneySchema = z.coerce
  .number({ invalid_type_error: 'Enter a valid amount' })
  .min(0, 'Amount cannot be negative')
  .max(10_000_000, 'Amount is unrealistically large')
  .refine((value) => Number.isFinite(value), 'Enter a valid amount');
