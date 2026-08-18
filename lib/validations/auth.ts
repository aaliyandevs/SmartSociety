import { z } from 'zod';

import { emailSchema } from '@/lib/validations/common';

export const loginSchema = z.object({
  /** Accepts either an email address or a username. */
  identifier: z
    .string()
    .trim()
    .min(3, 'Enter your email address or username')
    .max(120, 'That is too long to be a username'),
  password: z.string().min(1, 'Enter your password').max(200),
  next: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'That password is too long')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/\d/, 'Include at least one number');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Re-type the new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Choose a password you have not used before',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(80),
  email: emailSchema,
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  alternatePhone: z
    .union([z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'), z.literal('')])
    .optional(),
  occupation: z.string().trim().max(80).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
