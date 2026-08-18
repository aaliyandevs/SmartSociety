import { describe, expect, it } from 'vitest';

import { loginSchema, passwordSchema } from '@/lib/validations/auth';
import { phoneSchema, vehicleNumberSchema } from '@/lib/validations/common';
import { gatePassSchema } from '@/lib/validations/visitor';
import { complaintCreateSchema } from '@/lib/validations/complaint';
import { pollSchema } from '@/lib/validations/communication';
import { amenitySchema } from '@/lib/validations/amenity';

describe('input validation', () => {
  describe('phone numbers', () => {
    it('accepts a valid Pakistani mobile number', () => {
      expect(phoneSchema.safeParse('03001234567').success).toBe(true);
    });

    it('rejects wrong lengths and invalid leading digits', () => {
      expect(phoneSchema.safeParse('123456789').success).toBe(false);
      expect(phoneSchema.safeParse('123456789012').success).toBe(false);
      expect(phoneSchema.safeParse('1234567890').success).toBe(false);
      expect(phoneSchema.safeParse('0300abcdefg').success).toBe(false);
    });
  });

  describe('vehicle registration numbers', () => {
    it('normalises spacing and case', () => {
      expect(vehicleNumberSchema.parse('lea 1234')).toBe('LEA1234');
      expect(vehicleNumberSchema.parse('LEA-1234')).toBe('LEA1234');
    });

    it('rejects an obviously invalid plate', () => {
      expect(vehicleNumberSchema.safeParse('!!!').success).toBe(false);
      expect(vehicleNumberSchema.safeParse('1234').success).toBe(false);
    });
  });

  describe('passwords', () => {
    it('requires length, mixed case and a digit', () => {
      expect(passwordSchema.safeParse('Str0ngPass').success).toBe(true);
      expect(passwordSchema.safeParse('short1A').success).toBe(false);
      expect(passwordSchema.safeParse('alllowercase1').success).toBe(false);
      expect(passwordSchema.safeParse('ALLUPPERCASE1').success).toBe(false);
      expect(passwordSchema.safeParse('NoDigitsHere').success).toBe(false);
    });
  });

  describe('login', () => {
    it('accepts an email or a username as the identifier', () => {
      expect(loginSchema.safeParse({ identifier: 'admin@x.com', password: 'x' }).success).toBe(true);
      expect(loginSchema.safeParse({ identifier: 'admin', password: 'x' }).success).toBe(true);
    });

    it('rejects an empty password', () => {
      expect(loginSchema.safeParse({ identifier: 'admin', password: '' }).success).toBe(false);
    });
  });

  describe('gate passes', () => {
    const base = {
      visitorName: 'Ahmed Raza',
      visitorPhone: '03001234567',
      visitorType: 'GUEST' as const,
      maxEntries: 1,
    };

    it('accepts a sensible future window', () => {
      const result = gatePassSchema.safeParse({
        ...base,
        validFrom: new Date(Date.now() + 3_600_000),
        validUntil: new Date(Date.now() + 7_200_000),
      });
      expect(result.success).toBe(true);
    });

    it('rejects a window that ends before it starts', () => {
      const result = gatePassSchema.safeParse({
        ...base,
        validFrom: new Date(Date.now() + 7_200_000),
        validUntil: new Date(Date.now() + 3_600_000),
      });
      expect(result.success).toBe(false);
    });

    it('rejects a window that has already elapsed', () => {
      const result = gatePassSchema.safeParse({
        ...base,
        validFrom: new Date(Date.now() - 7_200_000),
        validUntil: new Date(Date.now() - 3_600_000),
      });
      expect(result.success).toBe(false);
    });

    it('rejects a pass valid for more than 30 days', () => {
      const result = gatePassSchema.safeParse({
        ...base,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 40 * 86_400_000),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('complaints', () => {
    it('requires a meaningful description', () => {
      const result = complaintCreateSchema.safeParse({
        title: 'Tap leaking',
        category: 'PLUMBING',
        priority: 'MEDIUM',
        description: 'too short',
      });
      expect(result.success).toBe(false);
    });

    it('accepts a well-formed ticket', () => {
      const result = complaintCreateSchema.safeParse({
        title: 'Kitchen sink drain is blocked',
        category: 'PLUMBING',
        priority: 'MEDIUM',
        description: 'Water drains very slowly and there is a foul smell from the pipe.',
        location: 'Kitchen',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('polls', () => {
    const base = {
      title: 'Should we install solar panels?',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 86_400_000),
    };

    it('requires at least two options', () => {
      expect(pollSchema.safeParse({ ...base, options: ['Yes'] }).success).toBe(false);
    });

    it('rejects duplicate options', () => {
      expect(pollSchema.safeParse({ ...base, options: ['Yes', 'yes'] }).success).toBe(false);
    });

    it('requires the poll to close after it opens', () => {
      expect(
        pollSchema.safeParse({
          ...base,
          options: ['Yes', 'No'],
          endsAt: new Date(Date.now() - 86_400_000),
        }).success,
      ).toBe(false);
    });

    it('accepts a valid poll', () => {
      expect(pollSchema.safeParse({ ...base, options: ['Yes', 'No', 'Need details'] }).success).toBe(
        true,
      );
    });
  });

  describe('amenities', () => {
    const base = {
      name: 'Swimming Pool',
      capacity: 25,
      slotMinutes: 60,
      bookingFee: 0,
      maxAdvanceDays: 30,
      minCancelHours: 4,
      maxSlotsPerBooking: 2,
    };

    it('requires the closing time to be after the opening time', () => {
      expect(
        amenitySchema.safeParse({ ...base, openMinute: 1200, closeMinute: 600 }).success,
      ).toBe(false);
    });

    it('requires the opening hours to divide evenly into slots', () => {
      // 06:00–20:30 is 870 minutes, which is not a multiple of 60.
      expect(
        amenitySchema.safeParse({ ...base, openMinute: 360, closeMinute: 1230 }).success,
      ).toBe(false);
    });

    it('accepts an evenly-divisible configuration', () => {
      expect(
        amenitySchema.safeParse({ ...base, openMinute: 360, closeMinute: 1260 }).success,
      ).toBe(true);
    });
  });
});
