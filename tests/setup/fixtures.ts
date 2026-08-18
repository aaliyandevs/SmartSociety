import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Test fixtures.
 *
 * `resetDatabase()` truncates every table between test files, and
 * `seedBaseline()` builds the smallest society that still exercises real
 * relationships: one block, two flats, an owner, a guard, a technician and an
 * administrator.
 */

export const prisma = new PrismaClient();

/** Cheap hash — tests do not need production cost factors. */
export const TEST_PASSWORD = 'Test@12345';
const testHash = () => bcrypt.hash(TEST_PASSWORD, 4);

export async function resetDatabase(): Promise<void> {
  // TRUNCATE ... CASCADE is far faster than deleting row by row and resets
  // every foreign key in one statement.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, notifications, poll_votes, poll_options, polls,
      notice_reads, notices, emergency_alerts,
      amenity_bookings, amenities,
      complaint_updates, complaint_attachments, complaints,
      payments, bill_charges, maintenance_bills,
      gate_logs, gate_passes, visitors,
      emergency_contacts, vehicles, family_members,
      resident_profiles, staff_profiles, sessions, users,
      flats, blocks, societies
    RESTART IDENTITY CASCADE
  `);
}

export interface Baseline {
  societyId: string;
  blockId: string;
  flatA: { id: string; label: string };
  flatB: { id: string; label: string };
  admin: { id: string; email: string };
  resident: { userId: string; residentId: string; email: string };
  resident2: { userId: string; residentId: string; email: string };
  guard: { userId: string; staffId: string; email: string };
  technician: { userId: string; staffId: string; email: string };
  amenity: { id: string; slug: string };
}

export async function seedBaseline(): Promise<Baseline> {
  const hash = await testHash();

  const society = await prisma.society.create({
    data: {
      name: 'Test Society',
      addressLine1: '1 Test Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411045',
      contactEmail: 'office@test.local',
      contactPhone: '9822000000',
      penaltyPercent: 2,
      penaltyGraceDays: 5,
    },
  });

  const block = await prisma.block.create({
    data: { societyId: society.id, name: 'A', totalFloors: 4 },
  });

  const flatA = await prisma.flat.create({
    data: {
      blockId: block.id,
      flatNumber: '101',
      floor: 1,
      baseMaintenance: 3000,
      occupancyStatus: 'OCCUPIED',
      occupancyType: 'OWNER',
      parkingSlots: 2,
    },
  });

  const flatB = await prisma.flat.create({
    data: {
      blockId: block.id,
      flatNumber: '102',
      floor: 1,
      baseMaintenance: 4000,
      occupancyStatus: 'OCCUPIED',
      occupancyType: 'TENANT',
      parkingSlots: 1,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@test.local',
      username: 'testadmin',
      passwordHash: hash,
      role: 'ADMIN',
      fullName: 'Test Admin',
      phone: '9822000001',
    },
  });

  const makeResident = async (
    email: string,
    username: string,
    fullName: string,
    phone: string,
    flatId: string,
    residentType: Prisma.ResidentProfileCreateInput['residentType'],
  ) => {
    const user = await prisma.user.create({
      data: { email, username, passwordHash: hash, role: 'RESIDENT', fullName, phone },
    });
    const profile = await prisma.residentProfile.create({
      data: { userId: user.id, flatId, residentType, isPrimary: true },
    });
    return { userId: user.id, residentId: profile.id, email };
  };

  const resident = await makeResident(
    'resident@test.local',
    'testresident',
    'Test Resident',
    '9822000002',
    flatA.id,
    'OWNER',
  );

  const resident2 = await makeResident(
    'resident2@test.local',
    'testresident2',
    'Second Resident',
    '9822000003',
    flatB.id,
    'TENANT',
  );

  const guardUser = await prisma.user.create({
    data: {
      email: 'guard@test.local',
      username: 'testguard',
      passwordHash: hash,
      role: 'GUARD',
      fullName: 'Test Guard',
      phone: '9822000004',
    },
  });
  const guardProfile = await prisma.staffProfile.create({
    data: {
      userId: guardUser.id,
      employeeCode: 'SEC-TEST',
      department: 'SECURITY',
      designation: 'Security Guard',
      gateAssignment: 'Main Gate',
    },
  });

  const techUser = await prisma.user.create({
    data: {
      email: 'tech@test.local',
      username: 'testtech',
      passwordHash: hash,
      role: 'MAINTENANCE_STAFF',
      fullName: 'Test Technician',
      phone: '9822000005',
    },
  });
  const techProfile = await prisma.staffProfile.create({
    data: {
      userId: techUser.id,
      employeeCode: 'EMP-TEST',
      department: 'PLUMBING',
      designation: 'Plumber',
    },
  });

  const amenity = await prisma.amenity.create({
    data: {
      societyId: society.id,
      name: 'Test Clubhouse',
      slug: 'test-clubhouse',
      capacity: 50,
      openMinute: 8 * 60,
      closeMinute: 20 * 60,
      slotMinutes: 60,
      bookingFee: 500,
      maxAdvanceDays: 30,
      minCancelHours: 4,
      maxSlotsPerBooking: 3,
      requiresApproval: false,
    },
  });

  return {
    societyId: society.id,
    blockId: block.id,
    flatA: { id: flatA.id, label: 'A-101' },
    flatB: { id: flatB.id, label: 'A-102' },
    admin: { id: adminUser.id, email: adminUser.email },
    resident,
    resident2,
    guard: { userId: guardUser.id, staffId: guardProfile.id, email: guardUser.email },
    technician: { userId: techUser.id, staffId: techProfile.id, email: techUser.email },
    amenity: { id: amenity.id, slug: amenity.slug },
  };
}

/** A date at the top of the hour, `hoursFromNow` in the future. */
export function futureSlot(hoursFromNow: number, baseHour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(hoursFromNow / 24) + 1);
  date.setHours(baseHour, 0, 0, 0);
  return date;
}
