import type { Role } from '@prisma/client';

/**
 * Evaluation credentials created by `prisma/seed.ts`.
 *
 * These are demonstration accounts for a locally-seeded database and are
 * documented as a submission deliverable (SRS §1.9 — "User Credentials for all
 * Types of Users with Passwords"). Change or remove them before any real
 * deployment; see README → "Known limitations".
 */
export interface DemoAccount {
  role: Role;
  label: string;
  email: string;
  password: string;
  blurb: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'ADMIN',
    label: 'Administrator',
    email: 'admin@smartsociety.local',
    password: 'Admin@12345',
    blurb: 'Full control: residents, flats, billing, complaints, security and audit logs.',
  },
  {
    role: 'RESIDENT',
    label: 'Resident',
    email: 'resident@smartsociety.local',
    password: 'Resident@12345',
    blurb: 'Bills, visitor passes, complaints, amenity bookings, notices and polls.',
  },
  {
    role: 'GUARD',
    label: 'Security Guard',
    email: 'guard@smartsociety.local',
    password: 'Guard@12345',
    blurb: 'Gate console: scan passes, log walk-ins, record entry and exit.',
  },
  {
    role: 'MAINTENANCE_STAFF',
    label: 'Maintenance Staff',
    email: 'maintenance@smartsociety.local',
    password: 'Maintenance@12345',
    blurb: 'Assigned tickets, work notes and resolution tracking.',
  },
];
