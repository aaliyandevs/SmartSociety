import { z } from 'zod';

import {
  cuidSchema,
  dateTimeSchema,
  nameSchema,
  optionalDateTimeSchema,
  optionalText,
  optionalVehicleNumberSchema,
  phoneSchema,
} from '@/lib/validations/common';

const visitorTypeSchema = z.enum(['GUEST', 'DELIVERY', 'CAB', 'VENDOR', 'SERVICE', 'OTHER']);

/** Resident pre-approves a visitor and receives a QR + numeric gate code. */
export const gatePassSchema = z
  .object({
    visitorName: nameSchema,
    visitorPhone: phoneSchema,
    visitorType: visitorTypeSchema,
    vehicleNumber: optionalVehicleNumberSchema,
    company: optionalText(80),
    purpose: optionalText(200),
    validFrom: dateTimeSchema,
    validUntil: dateTimeSchema,
    maxEntries: z.coerce.number().int().min(1, 'At least one entry').max(10).default(1),
  })
  .refine((data) => data.validUntil > data.validFrom, {
    message: 'The end of the visit window must be after the start',
    path: ['validUntil'],
  })
  .refine((data) => data.validUntil.getTime() - data.validFrom.getTime() <= 30 * 24 * 60 * 60 * 1000, {
    message: 'A pass cannot stay valid for more than 30 days',
    path: ['validUntil'],
  })
  .refine((data) => data.validUntil.getTime() > Date.now() - 60_000, {
    message: 'The visit window has already ended',
    path: ['validUntil'],
  });

export type GatePassInput = z.infer<typeof gatePassSchema>;

export const cancelGatePassSchema = z.object({
  passId: cuidSchema,
  reason: optionalText(200),
});

/** A guard verifies a pass by scanning the QR or typing the 6-digit gate code. */
export const verifyPassSchema = z.object({
  /** Raw QR payload, pass code, or 6-digit gate code — all handled server side. */
  code: z.string().trim().min(4, 'Enter or scan a gate pass code').max(400),
  method: z.enum(['QR_SCAN', 'GATE_CODE']).default('GATE_CODE'),
});

export type VerifyPassInput = z.infer<typeof verifyPassSchema>;

export const approveEntrySchema = z.object({
  passId: cuidSchema,
  gate: z.string().trim().min(2).max(40).default('Main Gate'),
  vehicleNumber: optionalVehicleNumberSchema,
  expectedExitAt: optionalDateTimeSchema,
  remarks: optionalText(200),
});

export const rejectEntrySchema = z.object({
  passId: cuidSchema,
  gate: z.string().trim().min(2).max(40).default('Main Gate'),
  reason: z.string().trim().min(3, 'Give a short reason for the refusal').max(200),
});

/** Walk-in visitor with no pre-approval — logged manually at the gate. */
export const walkInVisitorSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  visitorType: visitorTypeSchema,
  flatId: cuidSchema,
  vehicleNumber: optionalVehicleNumberSchema,
  company: optionalText(80),
  idProofType: optionalText(30),
  idProofNumber: optionalText(40),
  gate: z.string().trim().min(2).max(40).default('Main Gate'),
  expectedExitAt: optionalDateTimeSchema,
  remarks: optionalText(200),
});

export type WalkInVisitorInput = z.infer<typeof walkInVisitorSchema>;

export const recordExitSchema = z.object({
  gateLogId: cuidSchema,
  remarks: optionalText(200),
});
