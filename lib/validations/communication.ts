import { z } from 'zod';

import {
  cuidSchema,
  dateTimeSchema,
  optionalDateTimeSchema,
  optionalText,
} from '@/lib/validations/common';

// ── Notices ───────────────────────────────────────────────────────────────────

export const noticeSchema = z
  .object({
    title: z.string().trim().min(5, 'Give the notice a title').max(140),
    content: z.string().trim().min(20, 'Write at least 20 characters').max(20_000),
    category: z.enum([
      'GENERAL',
      'MAINTENANCE',
      'EVENT',
      'FINANCIAL',
      'SECURITY',
      'GUIDELINE',
      'EMERGENCY',
    ]),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
    audience: z.enum(['ALL', 'RESIDENTS', 'OWNERS', 'TENANTS', 'STAFF']),
    publishAt: dateTimeSchema,
    expiresAt: optionalDateTimeSchema,
    eventDate: optionalDateTimeSchema,
    eventLocation: optionalText(120),
    isPinned: z.coerce.boolean().default(false),
    isPublished: z.coerce.boolean().default(true),
  })
  .refine((data) => !data.expiresAt || data.expiresAt > data.publishAt, {
    message: 'The expiry date must be after the publish date',
    path: ['expiresAt'],
  });

export type NoticeInput = z.infer<typeof noticeSchema>;

// ── Polls ─────────────────────────────────────────────────────────────────────

export const pollSchema = z
  .object({
    title: z.string().trim().min(5, 'Enter the poll question').max(160),
    description: optionalText(1000),
    options: z
      .array(z.string().trim().min(1, 'Option cannot be blank').max(120))
      .min(2, 'A poll needs at least two options')
      .max(10, 'Keep it to 10 options or fewer'),
    startsAt: dateTimeSchema,
    endsAt: dateTimeSchema,
    isAnonymous: z.coerce.boolean().default(true),
    showLiveResults: z.coerce.boolean().default(false),
    status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).default('ACTIVE'),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'The poll must close after it opens',
    path: ['endsAt'],
  })
  .refine((data) => new Set(data.options.map((o) => o.toLowerCase())).size === data.options.length, {
    message: 'Poll options must be unique',
    path: ['options'],
  });

export type PollInput = z.infer<typeof pollSchema>;

export const voteSchema = z.object({
  pollId: cuidSchema,
  optionId: cuidSchema,
});

export const pollStatusSchema = z.object({
  pollId: cuidSchema,
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']),
});

// ── Emergency alerts ──────────────────────────────────────────────────────────

export const emergencyAlertSchema = z.object({
  type: z.enum([
    'FIRE',
    'SECURITY',
    'MEDICAL',
    'WATER_SHUTDOWN',
    'POWER_OUTAGE',
    'GAS_LEAK',
    'NATURAL_DISASTER',
    'GENERAL',
  ]),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  title: z.string().trim().min(5, 'Enter a short alert headline').max(120),
  message: z.string().trim().min(10, 'Explain what is happening').max(2000),
  instructions: optionalText(1000),
  targetBlockId: z.union([cuidSchema, z.literal('')]).optional(),
  sirenEnabled: z.coerce.boolean().default(true),
});

export type EmergencyAlertInput = z.infer<typeof emergencyAlertSchema>;

export const resolveAlertSchema = z.object({
  alertId: cuidSchema,
  resolutionNote: optionalText(500),
});
