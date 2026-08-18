import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { hashToken, signSessionToken, verifySessionToken } from '@/lib/auth/jwt';
import { checkRateLimit, resetRateLimits } from '@/lib/rate-limit';
import { authenticate, changePassword, deriveUsername } from '@/services/auth-service';
import { UnauthorizedError, AppError } from '@/lib/errors';
import { TEST_PASSWORD, prisma, resetDatabase, seedBaseline, type Baseline } from '../setup/fixtures';

const SECRET = 'test-secret-value-that-is-long-enough-for-hs256-signing';

let baseline: Baseline;

beforeAll(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
  resetRateLimits();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('password hashing', () => {
  it('never stores the plaintext and verifies correctly', async () => {
    const hash = await hashPassword('Sup3rSecret');
    expect(hash).not.toContain('Sup3rSecret');
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyPassword('Sup3rSecret', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces a different hash for the same password each time', async () => {
    const [a, b] = await Promise.all([hashPassword('same-input'), hashPassword('same-input')]);
    expect(a).not.toBe(b);
  });
});

describe('session tokens', () => {
  it('signs and verifies a session with its claims intact', async () => {
    const token = await signSessionToken(
      { sub: 'user-1', sid: 'session-1', role: 'ADMIN', name: 'Test Admin' },
      SECRET,
      3600,
    );
    const claims = await verifySessionToken(token, SECRET);

    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe('user-1');
    expect(claims?.sid).toBe('session-1');
    expect(claims?.role).toBe('ADMIN');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSessionToken(
      { sub: 'user-1', sid: 'session-1', role: 'ADMIN', name: 'Test Admin' },
      SECRET,
      3600,
    );
    expect(await verifySessionToken(token, `${SECRET}-tampered`)).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = await signSessionToken(
      { sub: 'user-1', sid: 'session-1', role: 'RESIDENT', name: 'Resident' },
      SECRET,
      3600,
    );
    const [header, payload, signature] = token.split('.');
    // Flip the role claim in the payload; the signature should no longer match.
    const forged = Buffer.from(
      JSON.stringify({ sub: 'user-1', sid: 'session-1', role: 'ADMIN', name: 'Resident' }),
    ).toString('base64url');
    expect(await verifySessionToken(`${header}.${forged}.${signature}`, SECRET)).toBeNull();
    expect(payload).not.toBe(forged);
  });

  it('rejects an expired token', async () => {
    const token = await signSessionToken(
      { sub: 'user-1', sid: 'session-1', role: 'ADMIN', name: 'Test Admin' },
      SECRET,
      -10,
    );
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it('stores only a digest of the token, never the token itself', async () => {
    const token = await signSessionToken(
      { sub: 'user-1', sid: 'session-1', role: 'ADMIN', name: 'Test Admin' },
      SECRET,
      3600,
    );
    const digest = await hashToken(token);
    expect(digest).toHaveLength(64);
    expect(digest).not.toContain(token);
    expect(await hashToken(token)).toBe(digest);
  });
});

describe('authenticate()', () => {
  it('signs in with the email address', async () => {
    const user = await authenticate(baseline.resident.email, TEST_PASSWORD);
    expect(user.role).toBe('RESIDENT');
    expect(user.email).toBe(baseline.resident.email);
  });

  it('signs in with the username, case-insensitively', async () => {
    const user = await authenticate('TESTGUARD', TEST_PASSWORD);
    expect(user.role).toBe('GUARD');
  });

  it('rejects a wrong password with a generic message', async () => {
    await expect(authenticate(baseline.resident.email, 'WrongPassword1')).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('gives the same generic message for an unknown account, to prevent enumeration', async () => {
    await expect(authenticate('nobody@test.local', TEST_PASSWORD)).rejects.toThrow(
      /Invalid email\/username or password/,
    );
    await expect(authenticate(baseline.resident.email, 'nope')).rejects.toThrow(
      /Invalid email\/username or password/,
    );
  });

  it('records the failed attempt in the audit log', async () => {
    const before = await prisma.auditLog.count({ where: { action: 'auth.login.failed' } });
    await authenticate('nobody-else@test.local', 'whatever').catch(() => undefined);
    const after = await prisma.auditLog.count({ where: { action: 'auth.login.failed' } });
    expect(after).toBeGreaterThan(before);
  });

  it('locks the account after repeated failures and refuses even a correct password', async () => {
    const email = 'lockme@test.local';
    await prisma.user.create({
      data: {
        email,
        username: 'lockme',
        passwordHash: await hashPassword(TEST_PASSWORD),
        role: 'RESIDENT',
        fullName: 'Lock Me',
        phone: '9822000099',
      },
    });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await authenticate(email, 'DefinitelyWrong1').catch(() => undefined);
    }

    const locked = await prisma.user.findUnique({ where: { email } });
    expect(locked?.lockedUntil).not.toBeNull();
    await expect(authenticate(email, TEST_PASSWORD)).rejects.toThrow(/temporarily locked/);
  });

  it('refuses a suspended account', async () => {
    const email = 'suspended@test.local';
    await prisma.user.create({
      data: {
        email,
        username: 'suspended',
        passwordHash: await hashPassword(TEST_PASSWORD),
        role: 'RESIDENT',
        fullName: 'Suspended User',
        phone: '9822000098',
        status: 'SUSPENDED',
      },
    });

    await expect(authenticate(email, TEST_PASSWORD)).rejects.toThrow(/not active/);
  });

  it('resets the failure counter and stamps lastLoginAt on success', async () => {
    await authenticate(baseline.resident2.email, 'WrongOnce1').catch(() => undefined);
    await authenticate(baseline.resident2.email, TEST_PASSWORD);

    const user = await prisma.user.findUnique({ where: { email: baseline.resident2.email } });
    expect(user?.failedLoginCount).toBe(0);
    expect(user?.lastLoginAt).not.toBeNull();
  });
});

describe('changePassword()', () => {
  it('rejects an incorrect current password', async () => {
    await expect(
      changePassword(baseline.resident.userId, 'NotMyPassword1', 'BrandNewPass1'),
    ).rejects.toThrow(AppError);
  });

  it('changes the password and revokes every existing session', async () => {
    const session = await prisma.session.create({
      data: {
        userId: baseline.admin.id,
        tokenHash: 'digest-for-test',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await changePassword(baseline.admin.id, TEST_PASSWORD, 'RotatedPass1');

    const revoked = await prisma.session.findUnique({ where: { id: session.id } });
    expect(revoked?.revokedAt).not.toBeNull();

    // The new password works, the old one does not.
    await expect(authenticate(baseline.admin.email, 'RotatedPass1')).resolves.toMatchObject({
      role: 'ADMIN',
    });
    await expect(authenticate(baseline.admin.email, TEST_PASSWORD)).rejects.toThrow();
  });
});

describe('deriveUsername()', () => {
  it('derives a username from the email local part', async () => {
    expect(await deriveUsername('brand.new@test.local')).toBe('brand.new');
  });

  it('avoids collisions with an existing username', async () => {
    const first = await deriveUsername('testresident@other.local');
    expect(first).not.toBe('testresident');
    expect(first.startsWith('testresident')).toBe(true);
  });
});

describe('rate limiting', () => {
  it('allows requests up to the limit then blocks them', () => {
    resetRateLimits();
    const key = 'unit-test-key';

    for (let i = 0; i < 5; i += 1) {
      expect(checkRateLimit(key, 5, 60).allowed).toBe(true);
    }

    const blocked = checkRateLimit(key, 5, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks each key independently', () => {
    resetRateLimits();
    expect(checkRateLimit('key-a', 1, 60).allowed).toBe(true);
    expect(checkRateLimit('key-a', 1, 60).allowed).toBe(false);
    expect(checkRateLimit('key-b', 1, 60).allowed).toBe(true);
  });
});
