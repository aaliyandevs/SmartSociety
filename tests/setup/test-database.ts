import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolves the connection string for the dedicated test database.
 *
 * Vitest does not load `.env`, and values declared in `test.env` are only
 * visible inside worker processes — not in `globalSetup`. Both therefore import
 * this module so they agree on which database to use.
 */

function readEnvFile(key: string): string | undefined {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return undefined;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line);
    if (match && match[1] === key) {
      return match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

const DEFAULT_URL = 'postgresql://smartsociety:smartsociety@127.0.0.1:5433/smartsociety?schema=public';

/** Swaps the database name in a connection string for the test database. */
function toTestDatabase(url: string): string {
  return url.replace(/\/([^/?]+)(\?|$)/, '/smartsociety_test$2');
}

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  toTestDatabase(process.env.DATABASE_URL ?? readEnvFile('DATABASE_URL') ?? DEFAULT_URL);
