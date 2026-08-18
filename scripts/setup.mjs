#!/usr/bin/env node
/**
 * One-shot local setup:  npm run setup
 *
 *   1. creates .env from .env.example (if missing) with a fresh AUTH_SECRET
 *   2. starts the bundled PostgreSQL server (skipped if one is already running)
 *   3. applies migrations
 *   4. seeds realistic demo data
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');

const run = (cmd, args) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
};

const portOpen = (port) =>
  new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = (v) => {
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(1200);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });

async function main() {
  // 1 — environment file
  if (!existsSync(ENV_FILE)) {
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    const secret = randomBytes(48).toString('base64url');
    const contents = readFileSync(ENV_FILE, 'utf8').replace(
      /AUTH_SECRET="[^"]*"/,
      `AUTH_SECRET="${secret}"`,
    );
    writeFileSync(ENV_FILE, contents, 'utf8');
    console.log('Created .env with a freshly generated AUTH_SECRET.');
  } else {
    console.log('.env already exists — leaving it untouched.');
  }

  // 2 — database server
  const envUrl = readFileSync(ENV_FILE, 'utf8').match(/DATABASE_URL="([^"]+)"/)?.[1] ?? '';
  const port = Number(envUrl.match(/:(\d+)\//)?.[1] ?? 5432);
  if (await portOpen(port)) {
    console.log(`\nA PostgreSQL server is already listening on port ${port}.`);
  } else {
    console.log(`\nNo PostgreSQL server on port ${port}; starting the bundled one...`);
    run('node', ['scripts/db-server.mjs', 'start']);
  }

  // 3 & 4 — schema + demo data
  run('npx', ['prisma', 'migrate', 'deploy']);
  run('npx', ['prisma', 'generate']);
  run('npx', ['prisma', 'db', 'seed']);

  console.log(`
──────────────────────────────────────────────────────────────
 SmartSociety is ready.  Start the app with:   npm run dev
 Then open http://localhost:3000

 Demo accounts (password shown on the login page too):
   Administrator      admin@smartsociety.local        Admin@12345
   Resident           resident@smartsociety.local     Resident@12345
   Security Guard     guard@smartsociety.local        Guard@12345
   Maintenance Staff  maintenance@smartsociety.local  Maintenance@12345
──────────────────────────────────────────────────────────────`);
}

main().catch((error) => {
  console.error(`\nSetup failed: ${error.message}`);
  process.exit(1);
});
