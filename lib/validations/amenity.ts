import { z } from 'zod';

import { cuidSchema, dateTimeSchema, moneySchema, optionalText } from '@/lib/validations/common';

export const amenitySchema = z
  .object({
    name: z.string().trim().min(3, 'Enter an amenity name').max(60),
    description: optionalText(500),
    location: optionalText(80),
    capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').max(1000),
    openMinute: z.coerce.number().int().min(0).max(1439),
    closeMinute: z.coerce.number().int().min(1).max(1440),
    slotMinutes: z.coerce.number().int().min(15).max(480),
    bookingFee: moneySchema,
    maxAdvanceDays: z.coerce.number().int().min(1).max(180),
    minCancelHours: z.coerce.number().int().min(0).max(168),
    maxSlotsPerBooking: z.coerce.number().int().min(1).max(12),
    requiresApproval: z.coerce.boolean().default(false),
    isActive: z.coerce.boolean().default(true),
  })
  .refine((data) => data.closeMinute > data.openMinute, {
    message: 'Closing time must be after opening time',
    path: ['closeMinute'],
  })
  .refine((data) => (data.closeMinute - data.openMinute) % data.slotMinutes === 0, {
    message: 'The opening hours must divide evenly into slots of this length',
    path: ['slotMinutes'],
  });

export type AmenityInput = z.infer<typeof amenitySchema>;

export const bookingSchema = z.object({
  amenityId: cuidSchema,
  startsAt: dateTimeSchema,
  /** Number of consecutive slots to reserve. */
  slots: z.coerce.number().int().min(1, 'Book at least one slot').max(12).default(1),
  guestsCount: z.coerce.number().int().min(1, 'At least one guest').max(500).default(1),
  purpose: optionalText(200),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export const cancelBookingSchema = z.object({
  bookingId: cuidSchema,
  reason: optionalText(200),
});

export const reviewBookingSchema = z.object({
  bookingId: cuidSchema,
  decision: z.enum(['CONFIRMED', 'REJECTED']),
  reason: optionalText(200),
});
