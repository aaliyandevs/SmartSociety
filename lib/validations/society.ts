import { z } from 'zod';

import {
  cuidSchema,
  dateSchema,
  emailSchema,
  moneySchema,
  nameSchema,
  optionalPhoneSchema,
  optionalText,
  phoneSchema,
  vehicleNumberSchema,
} from '@/lib/validations/common';

// ── Blocks & flats ────────────────────────────────────────────────────────────

export const blockSchema = z.object({
  name: z.string().trim().min(1, 'Enter a block name').max(30),
  label: optionalText(80),
  totalFloors: z.coerce.number().int().min(1, 'At least one floor').max(80),
});

export const flatSchema = z.object({
  blockId: cuidSchema,
  flatNumber: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Enter a flat number')
    .max(12, 'Flat numbers are 12 characters or fewer'),
  floor: z.coerce.number().int().min(0, 'Floor cannot be negative').max(80),
  flatType: z.enum(['ONE_BHK', 'TWO_BHK', 'THREE_BHK', 'FOUR_BHK', 'PENTHOUSE', 'STUDIO']),
  carpetAreaSqft: z.coerce.number().int().min(100).max(20_000).optional(),
  occupancyStatus: z.enum(['OCCUPIED', 'VACANT', 'UNDER_MAINTENANCE']),
  parkingSlots: z.coerce.number().int().min(0).max(10),
  baseMaintenance: moneySchema,
});

export type FlatInput = z.infer<typeof flatSchema>;

// ── Residents ─────────────────────────────────────────────────────────────────

export const residentCreateSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  flatId: cuidSchema,
  residentType: z.enum(['OWNER', 'TENANT']),
  isPrimary: z.coerce.boolean().default(false),
  moveInDate: dateSchema,
  occupation: optionalText(80),
  alternatePhone: optionalPhoneSchema,
  /** Blank means "generate a temporary password and show it once". */
  password: z.union([z.string().min(8, 'Use at least 8 characters').max(200), z.literal('')]).optional(),
});

export type ResidentCreateInput = z.infer<typeof residentCreateSchema>;

export const residentUpdateSchema = residentCreateSchema
  .omit({ password: true, email: true })
  .extend({ residentId: cuidSchema, status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) });

export const residentOffboardSchema = z.object({
  residentId: cuidSchema,
  moveOutDate: dateSchema,
  reason: optionalText(300),
});

// ── Vehicles, family members, emergency contacts ──────────────────────────────

export const vehicleSchema = z.object({
  registrationNo: vehicleNumberSchema,
  vehicleType: z.enum(['CAR', 'BIKE', 'SCOOTER', 'BICYCLE', 'OTHER']),
  make: optionalText(40),
  model: optionalText(40),
  color: optionalText(24),
  parkingSlot: optionalText(16),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const familyMemberSchema = z.object({
  fullName: nameSchema,
  relation: z.string().trim().min(2, 'Enter the relationship').max(40),
  age: z.coerce.number().int().min(0).max(120).optional(),
  phone: optionalPhoneSchema,
  isDependent: z.coerce.boolean().default(false),
});

export type FamilyMemberInput = z.infer<typeof familyMemberSchema>;

export const emergencyContactSchema = z.object({
  name: nameSchema,
  relation: optionalText(40),
  designation: optionalText(60),
  phone: phoneSchema,
  altPhone: optionalPhoneSchema,
  email: z.union([emailSchema, z.literal('')]).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

// ── Staff ─────────────────────────────────────────────────────────────────────

export const staffCreateSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum(['GUARD', 'MAINTENANCE_STAFF']),
  department: z.enum([
    'PLUMBING',
    'ELECTRICAL',
    'HOUSEKEEPING',
    'ELEVATOR',
    'GARDENING',
    'SECURITY',
    'GENERAL',
  ]),
  designation: z.string().trim().min(2, 'Enter a designation').max(60),
  shift: optionalText(40),
  gateAssignment: optionalText(40),
  skills: z.array(z.string().trim().max(30)).max(12).default([]),
  password: z.union([z.string().min(8, 'Use at least 8 characters').max(200), z.literal('')]).optional(),
});

export type StaffCreateInput = z.infer<typeof staffCreateSchema>;

export const staffUpdateSchema = staffCreateSchema
  .omit({ password: true, email: true, role: true })
  .extend({ staffId: cuidSchema, status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']) });

// ── Society settings ──────────────────────────────────────────────────────────

export const societySettingsSchema = z.object({
  name: z.string().trim().min(3).max(120),
  addressLine1: z.string().trim().min(3).max(160),
  addressLine2: optionalText(160),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  postalCode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  guidelines: z.string().trim().max(20_000).optional(),
  penaltyPercent: z.coerce.number().min(0, 'Cannot be negative').max(25, 'Keep the penalty under 25%'),
  penaltyGraceDays: z.coerce.number().int().min(0).max(60),
});
