import { randomBytes, randomInt } from 'node:crypto';

/**
 * Human-facing reference generators.
 *
 * Ambiguous glyphs (0/O, 1/I/L) are excluded so a guard reading a pass aloud or
 * typing it on a tablet cannot get it wrong.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomFrom(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** e.g. "GP-7K4M2X" */
export function generatePassCode(): string {
  return `GP-${randomFrom(ALPHABET, 6)}`;
}

/** Six digits a guard can type when the camera cannot read the QR. */
export function generateGateCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

/** High-entropy opaque token embedded in the QR image. */
export function generateQrToken(): string {
  return randomBytes(32).toString('base64url');
}

/** e.g. "TKT-2026-0F3A9C" */
export function generateTicketNumber(year = new Date().getFullYear()): string {
  return `TKT-${year}-${randomFrom(ALPHABET, 6)}`;
}

/** e.g. "BK-9QW3ZT" */
export function generateBookingCode(): string {
  return `BK-${randomFrom(ALPHABET, 6)}`;
}

/** e.g. "INV-202603-A2F" for flat 'A-101' in March 2026. */
export function generateBillNumber(year: number, month: number, suffix: string): string {
  return `INV-${year}${String(month).padStart(2, '0')}-${suffix.toUpperCase()}`;
}

/** e.g. "RCPT-20260317-4KX8QW" */
export function generateReceiptNumber(date = new Date()): string {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate(),
  ).padStart(2, '0')}`;
  return `RCPT-${stamp}-${randomFrom(ALPHABET, 6)}`;
}

/** Simulated payment-gateway transaction reference. */
export function generateTransactionRef(): string {
  return `TXN${Date.now().toString(36).toUpperCase()}${randomFrom(ALPHABET, 6)}`;
}

export function generateEmployeeCode(prefix = 'EMP'): string {
  return `${prefix}-${randomFrom(ALPHABET, 5)}`;
}
