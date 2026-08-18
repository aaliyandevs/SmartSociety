#!/usr/bin/env node
/**
 * Local PostgreSQL bootstrapper for SmartSociety.
 *
 * Many evaluation machines have neither PostgreSQL nor Docker installed. This
 * script drives the real PostgreSQL binaries shipped by the `embedded-postgres`
 * packages against a project-local data directory, so `npm run db:up` is all
 * that is needed to get a working database.
 *
 * It calls `initdb` / `pg_ctl` directly (rather than through the library's
 * JavaScript wrapper) because `pg_ctl start` detaches the server, letting it
 * outlive this Node process — which is what you want from a `db:up` command.
 *
 * If you already run PostgreSQL (locally, Neon, Supabase, RDS, ...), ignore
 * this script entirely and just point DATABASE_URL at your instance.
 *
 *   node scripts/db-server.mjs start    # start (initialises on first run)
 *   node scripts/db-server.mjs stop     # stop
 *   node scripts/db-server.mjs status   # is it up?
 *   node scripts/db-server.mjs destroy  # stop and delete the data directory
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PG_ROOT = path.join(ROOT, '.postgres');
const DATA_DIR = path.join(PG_ROOT, 'data');
const LOG_FILE = path.join(PG_ROOT, 'server.log');
const PW_FILE = path.join(PG_ROOT, 'pwfile');

export const CONFIG = {
  user: process.env.LOCAL_PG_USER ?? 'smartsociety',
  password: process.env.LOCAL_PG_PASSWORD ?? 'smartsociety',
  port: Number(process.env.LOCAL_PG_PORT ?? 5433),
  database: process.env.LOCAL_PG_DATABASE ?? 'smartsociety',
};

export const localDatabaseUrl = () =>
  `postgresql://${CONFIG.user}:${CONFIG.password}@127.0.0.1:${CONFIG.port}/${CONFIG.database}?schema=public`;

// ── Locate the platform's PostgreSQL binaries ────────────────────────────────

const PLATFORM_NAMES = { win32: 'windows', darwin: 'darwin', linux: 'linux' };

function binDir() {
  const platform = PLATFORM_NAMES[process.platform];
  if (!platform) {
    throw new Error(
      `No bundled PostgreSQL binaries for platform "${process.platform}". ` +
        'Install PostgreSQL 14+ yourself and point DATABASE_URL at it.',
    );
  }

  const pkg = `@embedded-postgres/${platform}-${process.arch}`;

  // The binary packages declare an `exports` map that hides package.json, so
  // probe node_modules directly first and only fall back to resolution.
  const candidates = [path.join(ROOT, 'node_modules', ...pkg.split('/'), 'native', 'bin')];
  try {
    candidates.push(path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'native', 'bin'));
  } catch {
    /* exports map does not expose package.json — the direct probe above covers it */
  }

  const found = candidates.find((dir) => existsSync(dir));
  if (found) return found;

  throw new Error(
    `Could not find the PostgreSQL binaries from "${pkg}". Run \`npm install\` first, or ` +
      'install PostgreSQL 14+ yourself and point DATABASE_URL at it.',
  );
}

const exe = (name) => path.join(binDir(), process.platform === 'win32' ? `${name}.exe` : name);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    cwd: ROOT,
    ...options,
    env: { ...process.env, PGPASSWORD: CONFIG.password, ...options.env },
  });
  if (result.error) throw result.error;
  return result;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function waitForPort(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

// ── Commands ─────────────────────────────────────────────────────────────────

function initialise() {
  mkdirSync(PG_ROOT, { recursive: true });
  writeFileSync(PW_FILE, CONFIG.password, 'utf8');

  console.log('Initialising a fresh PostgreSQL cluster (first run only)…');
  const result = run(exe('initdb'), [
    '--pgdata', DATA_DIR,
    '--username', CONFIG.user,
    '--pwfile', PW_FILE,
    '--auth=scram-sha-256',
    // Without these, initdb inherits the host locale — on Windows that means a
    // WIN1252 cluster, which cannot store "₹" or any non-Latin-1 character.
    '--encoding=UTF8',
    '--locale=C',
  ]);

  if (result.status !== 0) {
    throw new Error(`initdb failed:\n${result.stderr || result.stdout}`);
  }

  // Only accept connections from this machine.
  writeFileSync(
    path.join(DATA_DIR, 'postgresql.auto.conf'),
    `port = ${CONFIG.port}\nlisten_addresses = '127.0.0.1'\n`,
    'utf8',
  );
  rmSync(PW_FILE, { force: true });
}

async function start() {
  if (await isPortOpen(CONFIG.port)) {
    console.log(`PostgreSQL is already listening on port ${CONFIG.port}.`);
    console.log(`DATABASE_URL="${localDatabaseUrl()}"`);
    return;
  }

  const firstRun = !existsSync(path.join(DATA_DIR, 'PG_VERSION'));
  if (firstRun) initialise();

  console.log(`Starting PostgreSQL on 127.0.0.1:${CONFIG.port}…`);
  /*
   * `stdio: 'ignore'` matters: the server postgres process inherits pg_ctl's
   * handles, so piping stdout would make spawnSync block until the *database*
   * exits rather than until pg_ctl returns. Server output goes to LOG_FILE, and
   * readiness is confirmed by polling the port below.
   */
  run(exe('pg_ctl'), ['-D', DATA_DIR, '-l', LOG_FILE, '-o', `-p ${CONFIG.port}`, 'start'], {
    stdio: 'ignore',
  });

  if (!(await waitForPort(CONFIG.port))) {
    throw new Error(`PostgreSQL did not start listening on port ${CONFIG.port}. See ${LOG_FILE}`);
  }

  // `createdb` exits non-zero when the database already exists — that is fine.
  const created = run(exe('createdb'), [
    '-h', '127.0.0.1',
    '-p', String(CONFIG.port),
    '-U', CONFIG.user,
    '-E', 'UTF8',
    '-T', 'template0',
    CONFIG.database,
  ]);
  if (created.status === 0) console.log(`Created database "${CONFIG.database}".`);

  console.log(`
PostgreSQL is running and will keep running in the background.

  DATABASE_URL="${localDatabaseUrl()}"

Next:  npx prisma migrate deploy && npm run db:seed
Stop:  npm run db:down`);
}

async function stop() {
  if (!existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    console.log('No local cluster found — nothing to stop.');
    return;
  }

  const result = run(exe('pg_ctl'), ['-D', DATA_DIR, '-m', 'fast', '-w', 'stop']);
  console.log(result.status === 0 ? 'PostgreSQL stopped.' : (result.stderr || result.stdout).trim());
}

async function status() {
  const up = await isPortOpen(CONFIG.port);
  console.log(up ? `PostgreSQL is UP on port ${CONFIG.port}.` : `PostgreSQL is DOWN on port ${CONFIG.port}.`);
  if (up) console.log(`DATABASE_URL="${localDatabaseUrl()}"`);
  process.exitCode = up ? 0 : 1;
}

async function destroy() {
  await stop();
  rmSync(PG_ROOT, { recursive: true, force: true });
  console.log('Deleted the local cluster. The next `npm run db:up` will start clean.');
}

const actions = { start, stop, status, destroy, url: async () => console.log(localDatabaseUrl()) };
const command = process.argv[2] ?? 'start';

if (!actions[command]) {
  console.error(`Unknown command "${command}". Use: start | stop | status | destroy | url`);
  process.exit(1);
}

actions[command]()
  .then(() => {
    if (command !== 'status') process.exit(0);
  })
  .catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
