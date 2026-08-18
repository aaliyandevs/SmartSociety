#!/usr/bin/env node
/**
 * Generates `database/schema.sql` — the plain-SQL database + table definitions
 * required as a submission deliverable by the SRS (§1.9).
 *
 * The file is assembled from the committed Prisma migrations so it can never
 * drift from the ORM schema.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'prisma', 'migrations');
const OUT_DIR = path.join(ROOT, 'database');
const OUT_FILE = path.join(OUT_DIR, 'schema.sql');

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((entry) => statSync(path.join(MIGRATIONS_DIR, entry)).isDirectory())
  .sort();

if (migrations.length === 0) {
  console.error('No migrations found. Run `npm run db:migrate` first.');
  process.exit(1);
}

const header = `-- ============================================================================
--  SmartSociety — Smart Society Management System
--  PostgreSQL 14+ database and table definitions
--
--  Generated from the Prisma migration history (prisma/migrations) by
--  \`npm run db:sql\`. Do not edit by hand — edit prisma/schema.prisma and
--  re-run the generator instead.
--
--  Usage:
--      createdb smartsociety
--      psql -d smartsociety -f database/schema.sql
--      -- then load demo data:
--      psql -d smartsociety -f database/seed-data.sql   (optional)
--      -- or, preferred:  npm run db:seed
-- ============================================================================

`;

const body = migrations
  .map((name) => {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
    return `-- ----------------------------------------------------------------------------\n-- Migration: ${name}\n-- ----------------------------------------------------------------------------\n\n${sql.trim()}\n`;
  })
  .join('\n');

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, `${header}${body}\n`, 'utf8');

console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} from ${migrations.length} migration(s).`);
