import { execSync } from 'node:child_process';

import { TEST_DATABASE_URL } from './test-database';

/**
 * Creates (if needed) and migrates the dedicated test database before the suite
 * runs. Using a separate database keeps the seeded demo data intact while the
 * tests truncate tables freely.
 */
export default async function globalSetup() {
  const url = TEST_DATABASE_URL;
  const parsed = new URL(url);
  const databaseName = parsed.pathname.replace(/^\//, '').split('?')[0];

  // Connect to the maintenance database to issue CREATE DATABASE.
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const { Client } = await import('pg');
  const client = new Client({ connectionString: adminUrl.toString() });

  try {
    await client.connect();
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ]);
    if (existing.rowCount === 0) {
      // Identifier is derived from our own config, and quoted, so this is safe.
      await client.query(`CREATE DATABASE "${databaseName}" ENCODING 'UTF8' TEMPLATE template0`);
      console.log(`[tests] Created database "${databaseName}".`);
    }
  } catch (error) {
    throw new Error(
      `Could not prepare the test database. Is PostgreSQL running? Start it with \`npm run db:up\`.\n${
        (error as Error).message
      }`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
