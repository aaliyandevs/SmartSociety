/**
 * Route availability check.
 *
 *   npm run dev            # in one terminal
 *   npm run check:pages    # in another
 *
 * Mints a real session for each demo role (through the same signing code the
 * application uses) and requests every page that role can reach, reporting the
 * HTTP status. It is a fast way to catch a rendering regression across the whole
 * app without booting a browser.
 */
import { PrismaClient, type Role } from '@prisma/client';

import { hashToken, signSessionToken } from '@/lib/auth/jwt';

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const SECRET = process.env.AUTH_SECRET ?? '';

if (!SECRET) {
  console.error('AUTH_SECRET is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const PAGES: Record<Role, string[]> = {
  ADMIN: [
    '/admin',
    '/admin/flats',
    '/admin/residents',
    '/admin/staff',
    '/admin/visitors',
    '/admin/security',
    '/admin/bills',
    '/admin/payments',
    '/admin/complaints',
    '/admin/amenities',
    '/admin/notices',
    '/admin/polls',
    '/admin/alerts',
    '/admin/reports',
    '/admin/audit',
    '/admin/settings',
  ],
  RESIDENT: [
    '/resident',
    '/resident/flat',
    '/resident/vehicles',
    '/resident/bills',
    '/resident/payments',
    '/resident/visitors',
    '/resident/visitors/new',
    '/resident/complaints',
    '/resident/complaints/new',
    '/resident/amenities',
    '/resident/notices',
    '/resident/polls',
    '/resident/guidelines',
    '/resident/emergency',
  ],
  GUARD: [
    '/guard',
    '/guard/verify',
    '/guard/walk-in',
    '/guard/logs',
    '/guard/expected',
    '/guard/vehicles',
    '/guard/alerts',
    '/guard/directory',
  ],
  MAINTENANCE_STAFF: ['/staff', '/staff/tickets', '/staff/history', '/staff/notices', '/staff/alerts'],
};

const COMMON = ['/account', '/account/notifications', '/account/security'];

const ACCOUNTS: { role: Role; email: string }[] = [
  { role: 'ADMIN', email: 'admin@smartsociety.local' },
  { role: 'RESIDENT', email: 'resident@smartsociety.local' },
  { role: 'GUARD', email: 'guard@smartsociety.local' },
  { role: 'MAINTENANCE_STAFF', email: 'maintenance@smartsociety.local' },
];

async function cookieFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: `pending:${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 3_600_000),
      userAgent: 'smartsociety-route-check',
    },
  });

  const token = await signSessionToken(
    { sub: user.id, sid: session.id, role: user.role, name: user.fullName },
    SECRET,
    3600,
  );
  await prisma.session.update({
    where: { id: session.id },
    data: { tokenHash: await hashToken(token) },
  });

  return `smartsociety_session=${token}`;
}

async function main() {
  let failures = 0;
  let checked = 0;

  for (const account of ACCOUNTS) {
    const cookie = await cookieFor(account.email);
    console.log(`\n── ${account.role} ──`);

    for (const path of [...PAGES[account.role], ...COMMON]) {
      checked += 1;
      try {
        const started = Date.now();
        const response = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
        const elapsed = Date.now() - started;
        const ok = response.status === 200;
        if (!ok) failures += 1;
        console.log(
          `${ok ? 'PASS' : 'FAIL'}  ${String(response.status).padEnd(4)} ${String(`${elapsed}ms`).padStart(7)}  ${path}`,
        );
      } catch (error) {
        failures += 1;
        console.log(`FAIL  ERR        ${path} — ${(error as Error).message}`);
      }
    }
  }

  // Clean up the sessions this script created.
  await prisma.session.deleteMany({ where: { userAgent: 'smartsociety-route-check' } });

  console.log(
    `\n${failures === 0 ? `All ${checked} routes returned 200.` : `${failures} of ${checked} route(s) failed.`}`,
  );
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
