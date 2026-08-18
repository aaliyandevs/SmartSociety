import { RateLimitError } from '@/lib/errors';

/**
 * Small in-process fixed-window rate limiter.
 *
 * It protects the sensitive endpoints (login, gate verification, payment
 * simulation) from brute-force and accidental double submissions. A single
 * Node process is the deployment target described in the SRS (§1.8.1); a
 * multi-instance deployment should swap this for Redis — see
 * docs/architecture.md ("Known limitations").
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Throws a RateLimitError when the caller has exceeded the window. */
export function enforceRateLimit(key: string, limit: number, windowSeconds: number): void {
  const result = checkRateLimit(key, limit, windowSeconds);
  if (!result.allowed) {
    throw new RateLimitError(
      `Too many attempts. Please try again in ${result.retryAfterSeconds} second${
        result.retryAfterSeconds === 1 ? '' : 's'
      }.`,
    );
  }
}

/** Test helper — clears all counters. */
export function resetRateLimits(): void {
  buckets.clear();
}
