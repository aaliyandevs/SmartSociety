import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

import { ConflictError } from '@/lib/errors';
import { buildQrPayload } from '@/services/qr-service';
import {
  approveEntry,
  cancelGatePass,
  createGatePass,
  expireStalePasses,
  findOverstayingVisitors,
  logWalkInVisitor,
  recordExit,
  rejectEntry,
  verifyGateCode,
} from '@/services/gate-service';
import { prisma, resetDatabase, seedBaseline, type Baseline } from '../setup/fixtures';

let baseline: Baseline;

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000);

async function makePass(overrides: Partial<Parameters<typeof createGatePass>[0]> = {}) {
  return createGatePass({
    residentId: baseline.resident.residentId,
    flatId: baseline.flatA.id,
    visitorName: 'Ahmed Raza',
    visitorPhone: '03001234567',
    visitorType: 'GUEST',
    validFrom: hoursFromNow(-1),
    validUntil: hoursFromNow(4),
    maxEntries: 1,
    ...overrides,
  });
}

beforeAll(async () => {
  await resetDatabase();
  baseline = await seedBaseline();
});

beforeEach(async () => {
  // Clear gate state between tests but keep the society fixture.
  await prisma.gateLog.deleteMany();
  await prisma.gatePass.deleteMany();
  await prisma.visitor.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('creating a gate pass', () => {
  it('produces a unique pass code, a 6-digit gate code and a QR token', async () => {
    const pass = await makePass();

    expect(pass.passCode).toMatch(/^GP-[0-9A-Z]{6}$/);
    expect(pass.gateCode).toMatch(/^\d{6}$/);
    expect(pass.qrToken.length).toBeGreaterThan(20);
    expect(pass.status).toBe('ACTIVE');
    expect(pass.entriesUsed).toBe(0);
  });

  it('creates the visitor record linked to the flat', async () => {
    const pass = await makePass({ visitorName: 'Delivery Agent', visitorType: 'DELIVERY' });
    expect(pass.visitor.flatId).toBe(baseline.flatA.id);
    expect(pass.visitor.visitorType).toBe('DELIVERY');
  });

  it('issues distinct codes across many passes', async () => {
    const passes = await Promise.all([makePass(), makePass(), makePass(), makePass(), makePass()]);
    const gateCodes = new Set(passes.map((pass) => pass.gateCode));
    const qrTokens = new Set(passes.map((pass) => pass.qrToken));
    expect(gateCodes.size).toBe(5);
    expect(qrTokens.size).toBe(5);
  });
});

describe('verifying a pass', () => {
  it('accepts the QR payload', async () => {
    const pass = await makePass();
    const result = await verifyGateCode(buildQrPayload(pass.qrToken));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pass.visitor.name).toBe('Ahmed Raza');
      expect(result.pass.flat.label).toBe('A-101');
      expect(result.pass.host.name).toBe('Test Resident');
    }
  });

  it('accepts the 6-digit gate code typed by hand', async () => {
    const pass = await makePass();
    const result = await verifyGateCode(pass.gateCode);
    expect(result.ok).toBe(true);
  });

  it('accepts the printed pass code', async () => {
    const pass = await makePass();
    const result = await verifyGateCode(pass.passCode.toLowerCase());
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown code with a helpful reason', async () => {
    const result = await verifyGateCode('000000');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('NOT_FOUND');
      expect(result.detail).toMatch(/No gate pass matches/);
    }
  });

  it('rejects a pass whose window has not opened yet', async () => {
    const pass = await makePass({ validFrom: hoursFromNow(5), validUntil: hoursFromNow(9) });
    const result = await verifyGateCode(pass.gateCode);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('TOO_EARLY');
  });

  it('rejects an expired pass and marks it EXPIRED', async () => {
    const pass = await prisma.gatePass.update({
      where: { id: (await makePass()).id },
      data: { validFrom: hoursFromNow(-6), validUntil: hoursFromNow(-2) },
    });

    const result = await verifyGateCode(pass.gateCode);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('EXPIRED');

    const updated = await prisma.gatePass.findUnique({ where: { id: pass.id } });
    expect(updated?.status).toBe('EXPIRED');
  });

  it('rejects a cancelled pass', async () => {
    const pass = await makePass();
    await cancelGatePass(pass.id, baseline.resident.residentId, 'Plans changed');

    const result = await verifyGateCode(pass.gateCode);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('CANCELLED');
  });

  it('rejects a single-entry pass that has already been used', async () => {
    const pass = await makePass();
    const log = await approveEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      method: 'QR_SCAN',
    });
    await recordExit(log.id, baseline.guard.userId);

    const result = await verifyGateCode(pass.gateCode);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ALREADY_USED');
  });

  it('rejects a duplicate scan while the visitor is still inside', async () => {
    const pass = await makePass({ maxEntries: 3 });
    await approveEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      method: 'QR_SCAN',
    });

    const result = await verifyGateCode(pass.gateCode);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('ALREADY_INSIDE');
  });

  it('rejects a code that is too short to be real', async () => {
    const result = await verifyGateCode('12');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INVALID');
  });
});

describe('gate entry and exit', () => {
  it('records an entry, consumes the pass and stamps the time', async () => {
    const pass = await makePass();
    const log = await approveEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      method: 'GATE_CODE',
    });

    expect(log.status).toBe('INSIDE');
    expect(log.entryAt).not.toBeNull();
    expect(log.verificationMethod).toBe('GATE_CODE');
    expect(log.guardId).toBe(baseline.guard.userId);

    const updated = await prisma.gatePass.findUnique({ where: { id: pass.id } });
    expect(updated?.entriesUsed).toBe(1);
    expect(updated?.status).toBe('USED');
  });

  it('keeps a multi-entry pass active until every entry is used', async () => {
    const pass = await makePass({ maxEntries: 2 });

    const first = await approveEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      method: 'QR_SCAN',
    });
    let updated = await prisma.gatePass.findUnique({ where: { id: pass.id } });
    expect(updated?.status).toBe('ACTIVE');

    await recordExit(first.id, baseline.guard.userId);
    await approveEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      method: 'QR_SCAN',
    });
    updated = await prisma.gatePass.findUnique({ where: { id: pass.id } });
    expect(updated?.status).toBe('USED');
    expect(updated?.entriesUsed).toBe(2);
  });

  it('refuses a second concurrent entry for the same visitor', async () => {
    const pass = await makePass({ maxEntries: 3 });
    await approveEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      method: 'QR_SCAN',
    });

    await expect(
      approveEntry({
        passId: pass.id,
        guardId: baseline.guard.userId,
        gate: 'Main Gate',
        method: 'QR_SCAN',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('records an exit and refuses a duplicate exit', async () => {
    const pass = await makePass();
    const log = await approveEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      method: 'QR_SCAN',
    });

    const exited = await recordExit(log.id, baseline.guard.userId, 'Left on foot');
    expect(exited.status).toBe('EXITED');
    expect(exited.exitAt).not.toBeNull();

    await expect(recordExit(log.id, baseline.guard.userId)).rejects.toThrow(ConflictError);
  });

  it('records a refusal with its reason and marks the pass rejected', async () => {
    const pass = await makePass();
    const log = await rejectEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      reason: 'Resident unreachable on intercom',
    });

    expect(log.status).toBe('DENIED');
    expect(log.denialReason).toBe('Resident unreachable on intercom');

    const updated = await prisma.gatePass.findUnique({ where: { id: pass.id } });
    expect(updated?.status).toBe('REJECTED');
  });

  it('has no exit to record for a refused entry', async () => {
    const pass = await makePass();
    const log = await rejectEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      reason: 'No valid ID',
    });
    await expect(recordExit(log.id, baseline.guard.userId)).rejects.toThrow(ConflictError);
  });
});

describe('walk-in visitors', () => {
  it('creates the visitor and an INSIDE gate log in one step', async () => {
    const log = await logWalkInVisitor({
      guardId: baseline.guard.userId,
      flatId: baseline.flatB.id,
      name: 'Courier Person',
      phone: '03005345678',
      visitorType: 'DELIVERY',
      company: 'BlueDart',
      gate: 'Service Gate',
    });

    expect(log.status).toBe('INSIDE');
    expect(log.verificationMethod).toBe('MANUAL');
    expect(log.visitor.company).toBe('BlueDart');
    expect(log.gatePassId).toBeNull();
  });

  it('refuses to log a walk-in against a flat that does not exist', async () => {
    await expect(
      logWalkInVisitor({
        guardId: baseline.guard.userId,
        flatId: 'not-a-real-flat',
        name: 'Nobody',
        phone: '03005345678',
        visitorType: 'GUEST',
        gate: 'Main Gate',
      }),
    ).rejects.toThrow();
  });
});

describe('housekeeping', () => {
  it('finds visitors who are still inside past their expected exit time', async () => {
    await logWalkInVisitor({
      guardId: baseline.guard.userId,
      flatId: baseline.flatA.id,
      name: 'Overstaying Vendor',
      phone: '03005345670',
      visitorType: 'VENDOR',
      gate: 'Service Gate',
      expectedExitAt: hoursFromNow(-2),
    });

    const overstays = await findOverstayingVisitors();
    expect(overstays.map((log) => log.visitor.name)).toContain('Overstaying Vendor');
  });

  it('expires active passes whose window has closed', async () => {
    const pass = await makePass();
    await prisma.gatePass.update({
      where: { id: pass.id },
      data: { validFrom: hoursFromNow(-6), validUntil: hoursFromNow(-1) },
    });

    const count = await expireStalePasses();
    expect(count).toBeGreaterThanOrEqual(1);

    const updated = await prisma.gatePass.findUnique({ where: { id: pass.id } });
    expect(updated?.status).toBe('EXPIRED');
  });
});

describe('pass cancellation', () => {
  it('lets the owning resident cancel an unused pass', async () => {
    const pass = await makePass();
    const cancelled = await cancelGatePass(pass.id, baseline.resident.residentId, 'Not coming');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelReason).toBe('Not coming');
  });

  it('hides another resident’s pass rather than revealing it exists', async () => {
    const pass = await makePass();
    await expect(cancelGatePass(pass.id, baseline.resident2.residentId)).rejects.toThrow(
      /no longer exists/,
    );
  });

  it('refuses to cancel a pass that has already been used', async () => {
    const pass = await makePass();
    await approveEntry({
      passId: pass.id,
      guardId: baseline.guard.userId,
      gate: 'Main Gate',
      method: 'QR_SCAN',
    });

    await expect(cancelGatePass(pass.id, baseline.resident.residentId)).rejects.toThrow(
      /already been used/,
    );
  });
});
