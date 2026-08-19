import 'server-only';

import type { Role, User } from '@prisma/client';

import prisma from '@/lib/prisma';
import { AppError, UnauthorizedError } from '@/lib/errors';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

/**
 * Credential handling.
 *
 * The generic "Invalid email/username or password." message is deliberate: it
 * prevents account enumeration. Repeated failures lock the account temporarily,
 * which — together with the IP rate limit applied in the action layer — covers
 * the "Data Privacy & Security" non-functional requirement.
 */

const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'username' | 'fullName' | 'role' | 'status'>;

export async function authenticate(identifier: string, password: string): Promise<AuthenticatedUser> {
  const lookup = identifier.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ email: lookup }, { username: lookup }],
    },
  });

  if (!user) {
    // Constant-ish work regardless of whether the account exists, so response
    // timing does not reveal valid usernames.
    await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: 'User',
      description: `Failed login attempt for unknown account "${identifier}".`,
      metadata: { identifier },
    });
    throw new UnauthorizedError('Invalid email/username or password.');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(
      `This account is temporarily locked after too many failed attempts. Try again in ${minutes} minute${
        minutes === 1 ? '' : 's'
      }.`,
      { code: 'ACCOUNT_LOCKED', status: 423 },
    );
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    const failedCount = user.failedLoginCount + 1;
    const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failedCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: 'User',
      entityId: user.id,
      description: `Failed login attempt for ${user.email}${shouldLock ? ' — account locked.' : '.'}`,
      metadata: { attempt: failedCount, locked: shouldLock },
      actor: { id: null, name: user.fullName, role: user.role },
    });

    throw new UnauthorizedError('Invalid email/username or password.');
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(
      'This account is not active. Please contact the society administrator.',
      { code: 'ACCOUNT_INACTIVE', status: 403 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
  };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, fullName: true, role: true },
  });
  if (!user) throw new UnauthorizedError();

  const matches = await verifyPassword(currentPassword, user.passwordHash);
  if (!matches) {
    throw new AppError('Your current password is incorrect.', {
      code: 'BAD_PASSWORD',
      fieldErrors: { currentPassword: ['Your current password is incorrect.'] },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Force every other device to log in again.
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    entityType: 'User',
    entityId: userId,
    description: 'Password changed; all other sessions were revoked.',
    actor: { id: user.id, name: user.fullName, role: user.role },
  });
}

/** Derives a unique, readable username from an email address. */
export async function deriveUsername(email: string): Promise<string> {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 24) || 'user';

  let candidate = base;
  let suffix = 1;
  // Collisions are rare, so a short loop is cheaper than a random suffix.
  while (await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

export async function createUserAccount(input: {
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  password: string;
}): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw new AppError('An account with that email address already exists.', {
      code: 'EMAIL_TAKEN',
      fieldErrors: { email: ['An account with that email address already exists.'] },
    });
  }

  return prisma.user.create({
    data: {
      email: input.email,
      username: await deriveUsername(input.email),
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      phone: input.phone,
      role: input.role,
    },
  });
}

/** Temporary password handed to a newly on-boarded resident or staff member. */
export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const rest = Array.from({ length: 6 }, () => pick(upper + lower + digits)).join('');
  return `${pick(upper)}${pick(lower)}${pick(digits)}${rest}`;
}
