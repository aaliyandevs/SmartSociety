import 'server-only';

import type { Prisma, ResidentType, Role, StaffDepartment } from '@prisma/client';

import prisma from '@/lib/prisma';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { generateEmployeeCode } from '@/lib/codes';
import { createUserAccount, generateTemporaryPassword } from '@/services/auth-service';

/**
 * Flat, resident and staff administration (SRS §1.6, Administration #1):
 * onboard/offboard residents, tenants and owners; maintain flat occupancy maps.
 */

// ── Society settings ──────────────────────────────────────────────────────────

export async function getSociety() {
  const society = await prisma.society.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!society) {
    throw new AppError(
      'No society record found. Run `npm run db:seed` to initialise the society.',
      { code: 'NO_SOCIETY', status: 500 },
    );
  }
  return society;
}

// ── Flats ─────────────────────────────────────────────────────────────────────

export const flatListInclude = {
  block: true,
  residents: {
    where: { deletedAt: null },
    include: { user: { select: { id: true, fullName: true, phone: true, email: true } } },
    orderBy: { isPrimary: 'desc' },
  },
  vehicles: { where: { deletedAt: null } },
  _count: { select: { bills: true, complaints: true } },
} satisfies Prisma.FlatInclude;

export type FlatWithResidents = Prisma.FlatGetPayload<{ include: typeof flatListInclude }>;

export async function createFlat(input: {
  blockId: string;
  flatNumber: string;
  floor: number;
  flatType: Prisma.FlatCreateInput['flatType'];
  carpetAreaSqft?: number | null;
  occupancyStatus: Prisma.FlatCreateInput['occupancyStatus'];
  parkingSlots: number;
  baseMaintenance: number;
}) {
  const block = await prisma.block.findFirst({
    where: { id: input.blockId, deletedAt: null },
    select: { id: true, name: true, totalFloors: true },
  });
  if (!block) throw new NotFoundError('That block could not be found.');

  if (input.floor > block.totalFloors) {
    throw new AppError(`Block ${block.name} only has ${block.totalFloors} floors.`, {
      fieldErrors: { floor: [`Block ${block.name} only has ${block.totalFloors} floors.`] },
    });
  }

  const duplicate = await prisma.flat.findFirst({
    where: { blockId: block.id, flatNumber: input.flatNumber, deletedAt: null },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError(`Flat ${block.name}-${input.flatNumber} already exists.`);
  }

  return prisma.flat.create({
    data: {
      blockId: block.id,
      flatNumber: input.flatNumber,
      floor: input.floor,
      flatType: input.flatType,
      carpetAreaSqft: input.carpetAreaSqft ?? null,
      occupancyStatus: input.occupancyStatus,
      parkingSlots: input.parkingSlots,
      baseMaintenance: input.baseMaintenance,
    },
    include: { block: true },
  });
}

export async function updateFlat(
  flatId: string,
  input: Partial<{
    flatNumber: string;
    floor: number;
    flatType: Prisma.FlatUpdateInput['flatType'];
    carpetAreaSqft: number | null;
    occupancyStatus: Prisma.FlatUpdateInput['occupancyStatus'];
    parkingSlots: number;
    baseMaintenance: number;
  }>,
) {
  const flat = await prisma.flat.findFirst({
    where: { id: flatId, deletedAt: null },
    include: { block: true, residents: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!flat) throw new NotFoundError('That flat could not be found.');

  if (input.occupancyStatus === 'VACANT' && flat.residents.length > 0) {
    throw new ConflictError(
      'This flat still has residents on record. Offboard them before marking the unit vacant.',
    );
  }

  return prisma.flat.update({
    where: { id: flatId },
    data: input,
    include: { block: true },
  });
}

/** Soft delete — history (bills, complaints, gate logs) must stay intact. */
export async function archiveFlat(flatId: string) {
  const flat = await prisma.flat.findFirst({
    where: { id: flatId, deletedAt: null },
    include: { block: true, residents: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!flat) throw new NotFoundError('That flat could not be found.');
  if (flat.residents.length > 0) {
    throw new ConflictError('Offboard the residents of this flat before archiving it.');
  }

  const unpaid = await prisma.maintenanceBill.count({
    where: { flatId, status: { in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] } },
  });
  if (unpaid > 0) {
    throw new ConflictError(`This flat has ${unpaid} unsettled invoice(s). Clear them before archiving.`);
  }

  return prisma.flat.update({
    where: { id: flatId },
    data: { deletedAt: new Date(), occupancyStatus: 'VACANT' },
    include: { block: true },
  });
}

// ── Residents ─────────────────────────────────────────────────────────────────

export const residentListInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      avatarUrl: true,
    },
  },
  flat: { include: { block: true } },
  _count: { select: { vehicles: true, familyMembers: true, complaints: true } },
} satisfies Prisma.ResidentProfileInclude;

export type ResidentWithDetails = Prisma.ResidentProfileGetPayload<{
  include: typeof residentListInclude;
}>;

export interface OnboardResidentResult {
  residentId: string;
  userId: string;
  /** Returned once, so the admin can hand it over; never stored in plain text. */
  temporaryPassword: string | null;
}

export async function onboardResident(input: {
  fullName: string;
  email: string;
  phone: string;
  flatId: string;
  residentType: ResidentType;
  isPrimary: boolean;
  moveInDate: Date;
  occupation?: string | null;
  alternatePhone?: string | null;
  password?: string | null;
}): Promise<OnboardResidentResult> {
  const flat = await prisma.flat.findFirst({
    where: { id: input.flatId, deletedAt: null },
    include: { block: true, residents: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!flat) throw new NotFoundError('That flat could not be found.');

  const generated = !input.password;
  const password = input.password || generateTemporaryPassword();

  const user = await createUserAccount({
    email: input.email,
    fullName: input.fullName,
    phone: input.phone,
    role: 'RESIDENT',
    password,
  });

  const profile = await prisma.$transaction(async (tx) => {
    // The first resident of a flat is always primary.
    const isPrimary = flat.residents.length === 0 ? true : input.isPrimary;

    if (isPrimary) {
      await tx.residentProfile.updateMany({
        where: { flatId: flat.id, deletedAt: null },
        data: { isPrimary: false },
      });
    }

    const created = await tx.residentProfile.create({
      data: {
        userId: user.id,
        flatId: flat.id,
        residentType: input.residentType,
        isPrimary,
        moveInDate: input.moveInDate,
        occupation: input.occupation ?? null,
        alternatePhone: input.alternatePhone ?? null,
      },
    });

    await tx.flat.update({
      where: { id: flat.id },
      data: { occupancyStatus: 'OCCUPIED', occupancyType: input.residentType },
    });

    return created;
  });

  return {
    residentId: profile.id,
    userId: user.id,
    temporaryPassword: generated ? password : null,
  };
}

export async function updateResident(input: {
  residentId: string;
  fullName: string;
  phone: string;
  flatId: string;
  residentType: ResidentType;
  isPrimary: boolean;
  moveInDate: Date;
  occupation?: string | null;
  alternatePhone?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}) {
  const resident = await prisma.residentProfile.findFirst({
    where: { id: input.residentId, deletedAt: null },
    select: { id: true, userId: true, flatId: true },
  });
  if (!resident) throw new NotFoundError('That resident could not be found.');

  const flat = await prisma.flat.findFirst({
    where: { id: input.flatId, deletedAt: null },
    select: { id: true },
  });
  if (!flat) throw new NotFoundError('That flat could not be found.');

  return prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.residentProfile.updateMany({
        where: { flatId: input.flatId, deletedAt: null, id: { not: resident.id } },
        data: { isPrimary: false },
      });
    }

    await tx.user.update({
      where: { id: resident.userId },
      data: { fullName: input.fullName, phone: input.phone, status: input.status },
    });

    const updated = await tx.residentProfile.update({
      where: { id: resident.id },
      data: {
        flatId: input.flatId,
        residentType: input.residentType,
        isPrimary: input.isPrimary,
        moveInDate: input.moveInDate,
        occupation: input.occupation ?? null,
        alternatePhone: input.alternatePhone ?? null,
      },
      include: { flat: { include: { block: true } } },
    });

    await tx.flat.update({
      where: { id: input.flatId },
      data: { occupancyStatus: 'OCCUPIED', occupancyType: input.residentType },
    });

    // If the resident moved out of another flat, re-evaluate that flat.
    if (resident.flatId !== input.flatId) {
      const remaining = await tx.residentProfile.count({
        where: { flatId: resident.flatId, deletedAt: null },
      });
      if (remaining === 0) {
        await tx.flat.update({
          where: { id: resident.flatId },
          data: { occupancyStatus: 'VACANT', occupancyType: null },
        });
      }
    }

    return updated;
  });
}

/** Offboarding soft-deletes the profile and deactivates the login. */
export async function offboardResident(input: {
  residentId: string;
  moveOutDate: Date;
  reason?: string | null;
}) {
  const resident = await prisma.residentProfile.findFirst({
    where: { id: input.residentId, deletedAt: null },
    include: {
      user: { select: { id: true, fullName: true } },
      flat: { include: { block: true } },
    },
  });
  if (!resident) throw new NotFoundError('That resident could not be found.');

  const openBills = await prisma.maintenanceBill.count({
    where: { flatId: resident.flatId, status: { in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.residentProfile.update({
      where: { id: resident.id },
      data: { deletedAt: new Date(), moveOutDate: input.moveOutDate, isPrimary: false },
    });

    await tx.user.update({ where: { id: resident.userId }, data: { status: 'INACTIVE' } });
    await tx.session.updateMany({
      where: { userId: resident.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Cancel any gate passes this resident had issued.
    await tx.gatePass.updateMany({
      where: { residentId: resident.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Resident offboarded' },
    });

    const remaining = await tx.residentProfile.count({
      where: { flatId: resident.flatId, deletedAt: null },
    });
    if (remaining === 0) {
      await tx.flat.update({
        where: { id: resident.flatId },
        data: { occupancyStatus: 'VACANT', occupancyType: null },
      });
    } else {
      // Promote another resident to primary.
      const next = await tx.residentProfile.findFirst({
        where: { flatId: resident.flatId, deletedAt: null },
        orderBy: { moveInDate: 'asc' },
        select: { id: true },
      });
      if (next) await tx.residentProfile.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  });

  return {
    resident,
    flatLabel: `${resident.flat.block.name}-${resident.flat.flatNumber}`,
    openBills,
  };
}

// ── Staff ─────────────────────────────────────────────────────────────────────

export const staffListInclude = {
  user: {
    select: { id: true, fullName: true, email: true, phone: true, status: true, role: true, lastLoginAt: true },
  },
  _count: { select: { assignedComplaints: true } },
} satisfies Prisma.StaffProfileInclude;

export type StaffWithUser = Prisma.StaffProfileGetPayload<{ include: typeof staffListInclude }>;

export async function onboardStaff(input: {
  fullName: string;
  email: string;
  phone: string;
  role: Extract<Role, 'GUARD' | 'MAINTENANCE_STAFF'>;
  department: StaffDepartment;
  designation: string;
  shift?: string | null;
  gateAssignment?: string | null;
  skills: string[];
  password?: string | null;
}) {
  const generated = !input.password;
  const password = input.password || generateTemporaryPassword();

  const user = await createUserAccount({
    email: input.email,
    fullName: input.fullName,
    phone: input.phone,
    role: input.role,
    password,
  });

  const profile = await prisma.staffProfile.create({
    data: {
      userId: user.id,
      employeeCode: generateEmployeeCode(input.role === 'GUARD' ? 'SEC' : 'EMP'),
      department: input.department,
      designation: input.designation,
      shift: input.shift ?? null,
      gateAssignment: input.gateAssignment ?? null,
      skills: input.skills,
    },
    include: staffListInclude,
  });

  return { staff: profile, temporaryPassword: generated ? password : null };
}

export async function updateStaff(input: {
  staffId: string;
  fullName: string;
  phone: string;
  department: StaffDepartment;
  designation: string;
  shift?: string | null;
  gateAssignment?: string | null;
  skills: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}) {
  const staff = await prisma.staffProfile.findFirst({
    where: { id: input.staffId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!staff) throw new NotFoundError('That staff member could not be found.');

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: staff.userId },
      data: { fullName: input.fullName, phone: input.phone, status: input.status },
    });

    if (input.status !== 'ACTIVE') {
      await tx.session.updateMany({
        where: { userId: staff.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return tx.staffProfile.update({
      where: { id: staff.id },
      data: {
        department: input.department,
        designation: input.designation,
        shift: input.shift ?? null,
        gateAssignment: input.gateAssignment ?? null,
        skills: input.skills,
      },
      include: staffListInclude,
    });
  });
}

/**
 * Occupancy map for the admin flats page. `occupancyStatus`/`blockId` mirror
 * the same query params the unit-list tab filters on, so switching to the
 * map tab keeps showing what was just filtered for instead of silently
 * reverting to every block.
 */
export async function getOccupancyMap(filter?: {
  occupancyStatus?: Prisma.EnumOccupancyStatusFilter['equals'];
  blockId?: string;
}) {
  const blocks = await prisma.block.findMany({
    where: { deletedAt: null, ...(filter?.blockId ? { id: filter.blockId } : {}) },
    orderBy: { name: 'asc' },
    include: {
      flats: {
        where: { deletedAt: null, ...(filter?.occupancyStatus ? { occupancyStatus: filter.occupancyStatus } : {}) },
        orderBy: [{ floor: 'desc' }, { flatNumber: 'asc' }],
        include: {
          residents: {
            where: { deletedAt: null },
            select: { id: true, residentType: true, user: { select: { fullName: true } } },
            orderBy: { isPrimary: 'desc' },
          },
          _count: { select: { vehicles: { where: { deletedAt: null } } } },
        },
      },
    },
  });

  return blocks.map((block) => ({
    id: block.id,
    name: block.name,
    label: block.label,
    floors: Array.from(
      block.flats.reduce((map, flat) => {
        const list = map.get(flat.floor) ?? [];
        list.push(flat);
        map.set(flat.floor, list);
        return map;
      }, new Map<number, (typeof block.flats)[number][]>()),
    )
      .sort((a, b) => b[0] - a[0])
      .map(([floor, flats]) => ({ floor, flats })),
    occupied: block.flats.filter((flat) => flat.occupancyStatus === 'OCCUPIED').length,
    vacant: block.flats.filter((flat) => flat.occupancyStatus === 'VACANT').length,
    total: block.flats.length,
  }));
}
