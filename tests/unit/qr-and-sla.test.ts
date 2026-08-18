import { describe, expect, it } from 'vitest';

import { buildQrPayload, parseScannedCode } from '@/services/qr-service';
import { slaDueDate, slaState } from '@/services/complaint-service';
import { SLA_HOURS } from '@/lib/validations/complaint';

describe('QR payload handling', () => {
  it('round-trips a token through the payload format', () => {
    const token = 'abc123XYZ_token';
    expect(parseScannedCode(buildQrPayload(token))).toBe(token);
  });

  it('accepts a bare token, a pass code and a numeric gate code unchanged', () => {
    expect(parseScannedCode('GP-7K4M2X')).toBe('GP-7K4M2X');
    expect(parseScannedCode('483920')).toBe('483920');
    expect(parseScannedCode('  483920  ')).toBe('483920');
  });

  it('extracts the token when a scanner returns a URL', () => {
    expect(parseScannedCode('https://society.example/pass/tok_9f2')).toBe('tok_9f2');
    expect(parseScannedCode('https://society.example/verify?token=tok_abc')).toBe('tok_abc');
  });

  it('is case-insensitive about the payload prefix', () => {
    expect(parseScannedCode('smartsociety:pass:tok_1')).toBe('tok_1');
  });
});

describe('complaint SLA', () => {
  it('derives the due date from the priority', () => {
    const from = new Date('2026-03-01T10:00:00Z');
    for (const priority of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const) {
      const due = slaDueDate(priority, from);
      expect(due.getTime() - from.getTime()).toBe(SLA_HOURS[priority] * 3_600_000);
    }
  });

  it('gives critical tickets the tightest target', () => {
    expect(SLA_HOURS.CRITICAL).toBeLessThan(SLA_HOURS.HIGH);
    expect(SLA_HOURS.HIGH).toBeLessThan(SLA_HOURS.MEDIUM);
    expect(SLA_HOURS.MEDIUM).toBeLessThan(SLA_HOURS.LOW);
  });

  it('reports an open ticket past its target as breached', () => {
    const state = slaState({
      status: 'IN_PROGRESS',
      slaDueAt: new Date(Date.now() - 3_600_000),
      resolvedAt: null,
    });
    expect(state.overdue).toBe(true);
    expect(state.tone).toBe('destructive');
  });

  it('warns when an open ticket is due within four hours', () => {
    const state = slaState({
      status: 'PENDING',
      slaDueAt: new Date(Date.now() + 2 * 3_600_000),
      resolvedAt: null,
    });
    expect(state.overdue).toBe(false);
    expect(state.tone).toBe('warning');
  });

  it('reports a comfortably open ticket as on track', () => {
    const state = slaState({
      status: 'PENDING',
      slaDueAt: new Date(Date.now() + 40 * 3_600_000),
      resolvedAt: null,
    });
    expect(state.label).toBe('On track');
  });

  it('judges a settled ticket by when it was actually resolved', () => {
    const due = new Date('2026-03-02T10:00:00Z');

    const met = slaState({
      status: 'RESOLVED',
      slaDueAt: due,
      resolvedAt: new Date('2026-03-02T08:00:00Z'),
    });
    expect(met.label).toBe('Met SLA');
    expect(met.overdue).toBe(false);

    const missed = slaState({
      status: 'CLOSED',
      slaDueAt: due,
      resolvedAt: new Date('2026-03-03T08:00:00Z'),
    });
    expect(missed.label).toBe('Missed SLA');
    expect(missed.overdue).toBe(true);
  });
});
