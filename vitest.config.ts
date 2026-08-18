import path from 'node:path';
import { defineConfig } from 'vitest/config';

import { TEST_DATABASE_URL } from './tests/setup/test-database';

/**
 * Integration tests run against a *real* PostgreSQL database
 * (`smartsociety_test`), not a mock, so the constraints that enforce the
 * business rules — one vote per resident, one booking per slot — are genuinely
 * exercised. `tests/setup/global-setup.ts` creates and migrates it.
 */

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` deliberately throws outside a React Server Component;
      // stub it so the service layer can be imported by the test runner.
      'server-only': path.resolve(__dirname, 'tests/setup/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    globalSetup: ['./tests/setup/global-setup.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: 'test-secret-value-that-is-long-enough-for-hs256-signing',
      AUTH_SESSION_TTL: '3600',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_SOCIETY_NAME: 'Test Society',
      UPLOAD_DIR: 'uploads',
      UPLOAD_MAX_BYTES: '5242880',
    },
    // Database tests share one schema, so run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: ['default'],
  },
});
