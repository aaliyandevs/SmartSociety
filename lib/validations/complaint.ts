import { z } from 'zod';

import { cuidSchema, optionalText } from '@/lib/validations/common';

export const complaintCategorySchema = z.enum([
  'PLUMBING',
  'ELECTRICAL',
  'ELEVATOR',
  'CLEANING',
  'SECURITY',
  'WATER',
  'CARPENTRY',
  'PEST_CONTROL',
  'OTHER',
]);

export const complaintPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const complaintStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

export const complaintCreateSchema = z.object({
  title: z.string().trim().min(5, 'Give the issue a short title').max(120),
  category: complaintCategorySchema,
  priority: complaintPrioritySchema.default('MEDIUM'),
  description: z
    .string()
    .trim()
    .min(15, 'Describe the problem in at least 15 characters so the technician can prepare')
    .max(2000),
  location: optionalText(120),
});

export type ComplaintCreateInput = z.infer<typeof complaintCreateSchema>;

export const complaintAssignSchema = z.object({
  complaintId: cuidSchema,
  staffId: cuidSchema,
  priority: complaintPrioritySchema.optional(),
  note: optionalText(500),
});

export const complaintStatusSchema2 = z.object({
  complaintId: cuidSchema,
  status: complaintStatusSchema,
  note: z.string().trim().min(3, 'Add a short work note').max(1000),
  isInternal: z.coerce.boolean().default(false),
  resolutionNotes: optionalText(1000),
});

export type ComplaintStatusInput = z.infer<typeof complaintStatusSchema2>;

export const complaintNoteSchema = z.object({
  complaintId: cuidSchema,
  note: z.string().trim().min(3, 'Write a note').max(1000),
  isInternal: z.coerce.boolean().default(false),
});

export const complaintFeedbackSchema = z.object({
  complaintId: cuidSchema,
  satisfaction: z.coerce.number().int().min(1, 'Pick a rating').max(5),
});

/**
 * SLA targets per priority, in hours. Referenced by the resident's "Track SLA"
 * journey step (SRS §1.6, Common Features).
 */
export const SLA_HOURS: Record<z.infer<typeof complaintPrioritySchema>, number> = {
  CRITICAL: 4,
  HIGH: 12,
  MEDIUM: 48,
  LOW: 96,
};
