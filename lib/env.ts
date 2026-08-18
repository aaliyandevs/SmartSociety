/**
 * Centralised, validated access to environment configuration.
 *
 * Secrets are only ever read here (server side). Anything that must reach the
 * browser goes through a NEXT_PUBLIC_* variable and is re-exported explicitly.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Server-only configuration. Never import the secret fields into a client component. */
export const serverEnv = {
  get databaseUrl() {
    return required('DATABASE_URL', process.env.DATABASE_URL);
  },
  get authSecret() {
    const secret = required('AUTH_SECRET', process.env.AUTH_SECRET);
    if (secret.length < 32) {
      throw new Error('AUTH_SECRET must be at least 32 characters long.');
    }
    return secret;
  },
  get sessionTtlSeconds() {
    return int(process.env.AUTH_SESSION_TTL, 60 * 60 * 8);
  },
  get uploadDir() {
    return process.env.UPLOAD_DIR ?? 'uploads';
  },
  get uploadMaxBytes() {
    return int(process.env.UPLOAD_MAX_BYTES, 5 * 1024 * 1024);
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};

/** Safe to reference from client components. */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  societyName: process.env.NEXT_PUBLIC_SOCIETY_NAME ?? 'Green Meadows Residency',
};
