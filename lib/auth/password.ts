import bcrypt from 'bcryptjs';

/**
 * bcrypt cost factor. 12 keeps a single hash around ~250 ms on the reference
 * hardware in the SRS (§1.8.1) — slow enough to frustrate offline cracking,
 * fast enough not to breach the < 1.5 s page-response NFR.
 */
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Mirrors the client-side Zod rule so server and browser agree. */
export function passwordStrengthIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) issues.push('an uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('a lowercase letter');
  if (!/\d/.test(password)) issues.push('a number');
  return issues;
}
