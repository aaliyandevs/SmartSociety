'use server';

import { revalidatePath } from 'next/cache';

import { type ActionState, runAction, success } from '@/lib/action-result';
import { AUDIT_ACTIONS, auditActor, recordAudit } from '@/lib/audit';
import { requireResident, requireUser } from '@/lib/auth/session';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import prisma from '@/lib/prisma';
import { profileUpdateSchema } from '@/lib/validations/auth';
import {
  emergencyContactSchema,
  familyMemberSchema,
  vehicleSchema,
} from '@/lib/validations/society';

/**
 * A resident's own profile: personal details, vehicles, family members and
 * emergency contacts (SRS §1.6, Residents #1).
 *
 * Every query is scoped by the caller's own residentId, so one resident can
 * never read or modify another's records.
 */

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

const checkbox = (formData: FormData, key: string) =>
  formData.get(key) === 'on' || formData.get(key) === 'true';

export async function updateProfileAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireUser();

    const input = profileUpdateSchema.parse({
      fullName: formValue(formData, 'fullName'),
      email: formValue(formData, 'email'),
      phone: formValue(formData, 'phone'),
      alternatePhone: formValue(formData, 'alternatePhone') ?? '',
      occupation: formValue(formData, 'occupation') ?? '',
    });

    if (input.email !== user.email) {
      const taken = await prisma.user.findFirst({
        where: { email: input.email, id: { not: user.id } },
        select: { id: true },
      });
      if (taken) {
        throw new AppError('That email address is already in use.', {
          fieldErrors: { email: ['That email address is already in use.'] },
        });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { fullName: input.fullName, email: input.email, phone: input.phone },
    });

    if (user.residentId) {
      await prisma.residentProfile.update({
        where: { id: user.residentId },
        data: {
          alternatePhone: input.alternatePhone || null,
          occupation: input.occupation || null,
        },
      });
    }

    revalidatePath('/account');
    revalidatePath('/resident/flat');
    return success('Profile updated.');
  });
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

export async function saveVehicleAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireResident();
    const vehicleId = formValue(formData, 'vehicleId');

    const input = vehicleSchema.parse({
      registrationNo: formValue(formData, 'registrationNo'),
      vehicleType: formValue(formData, 'vehicleType'),
      make: formValue(formData, 'make'),
      model: formValue(formData, 'model'),
      color: formValue(formData, 'color'),
      parkingSlot: formValue(formData, 'parkingSlot'),
    });

    const clash = await prisma.vehicle.findFirst({
      where: {
        registrationNo: input.registrationNo,
        deletedAt: null,
        ...(vehicleId ? { id: { not: vehicleId } } : {}),
      },
      select: { id: true, residentId: true },
    });
    if (clash) {
      throw new ConflictError(
        clash.residentId === user.residentId
          ? 'You have already registered that vehicle.'
          : 'That registration number is already registered to another flat. Contact the society office.',
      );
    }

    if (vehicleId) {
      const owned = await prisma.vehicle.findFirst({
        where: { id: vehicleId, residentId: user.residentId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw new NotFoundError('That vehicle could not be found.');

      await prisma.vehicle.update({ where: { id: vehicleId }, data: input });
      revalidatePath('/resident/vehicles');
      return success('Vehicle updated.');
    }

    // Keep registrations within the flat's allotted parking.
    const [count, flat] = await Promise.all([
      prisma.vehicle.count({ where: { flatId: user.flatId, deletedAt: null } }),
      prisma.flat.findUnique({ where: { id: user.flatId }, select: { parkingSlots: true } }),
    ]);
    const limit = Math.max(1, (flat?.parkingSlots ?? 1) + 1); // one guest/two-wheeler allowance
    if (count >= limit) {
      throw new ConflictError(
        `Your flat has ${flat?.parkingSlots ?? 1} allotted parking slot(s). Contact the society office to register more vehicles.`,
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: { ...input, residentId: user.residentId, flatId: user.flatId },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.VEHICLE_CREATED,
      entityType: 'Vehicle',
      entityId: vehicle.id,
      description: `Registered vehicle ${vehicle.registrationNo} to flat ${user.flatLabel}.`,
      actor: auditActor(user),
    });

    revalidatePath('/resident/vehicles');
    revalidatePath('/resident/flat');
    return success(`${vehicle.registrationNo} registered.`);
  });
}

export async function deleteVehicleAction(vehicleId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireResident();

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, residentId: user.residentId, deletedAt: null },
      select: { id: true, registrationNo: true },
    });
    if (!vehicle) throw new NotFoundError('That vehicle could not be found.');

    // Soft delete so historical gate logs still make sense.
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { deletedAt: new Date() } });

    await recordAudit({
      action: AUDIT_ACTIONS.VEHICLE_DELETED,
      entityType: 'Vehicle',
      entityId: vehicle.id,
      description: `Removed vehicle ${vehicle.registrationNo} from flat ${user.flatLabel}.`,
      actor: auditActor(user),
    });

    revalidatePath('/resident/vehicles');
    return success(`${vehicle.registrationNo} removed.`);
  });
}

// ── Family members / tenants ──────────────────────────────────────────────────

export async function saveFamilyMemberAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireResident();
    const memberId = formValue(formData, 'memberId');

    const input = familyMemberSchema.parse({
      fullName: formValue(formData, 'fullName'),
      relation: formValue(formData, 'relation'),
      age: formValue(formData, 'age') || undefined,
      phone: formValue(formData, 'phone') ?? '',
      isDependent: checkbox(formData, 'isDependent'),
    });

    if (memberId) {
      const owned = await prisma.familyMember.findFirst({
        where: { id: memberId, residentId: user.residentId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw new NotFoundError('That family member could not be found.');

      await prisma.familyMember.update({ where: { id: memberId }, data: input });
      revalidatePath('/resident/flat');
      return success('Details updated.');
    }

    const member = await prisma.familyMember.create({
      data: { ...input, residentId: user.residentId },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.FAMILY_MEMBER_CREATED,
      entityType: 'FamilyMember',
      entityId: member.id,
      description: `Added family member "${member.fullName}" to flat ${user.flatLabel}.`,
      actor: auditActor(user),
    });

    revalidatePath('/resident/flat');
    return success(`${member.fullName} added to your household.`);
  });
}

export async function deleteFamilyMemberAction(memberId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireResident();

    const member = await prisma.familyMember.findFirst({
      where: { id: memberId, residentId: user.residentId, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!member) throw new NotFoundError('That family member could not be found.');

    await prisma.familyMember.update({ where: { id: member.id }, data: { deletedAt: new Date() } });

    await recordAudit({
      action: AUDIT_ACTIONS.FAMILY_MEMBER_DELETED,
      entityType: 'FamilyMember',
      entityId: member.id,
      description: `Removed family member "${member.fullName}" from flat ${user.flatLabel}.`,
      actor: auditActor(user),
    });

    revalidatePath('/resident/flat');
    return success(`${member.fullName} removed.`);
  });
}

// ── Personal emergency contacts ───────────────────────────────────────────────

export async function saveEmergencyContactAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireResident();
    const contactId = formValue(formData, 'contactId');

    const input = emergencyContactSchema.parse({
      name: formValue(formData, 'name'),
      relation: formValue(formData, 'relation'),
      designation: formValue(formData, 'designation'),
      phone: formValue(formData, 'phone'),
      altPhone: formValue(formData, 'altPhone') ?? '',
      email: formValue(formData, 'email') ?? '',
      sortOrder: formValue(formData, 'sortOrder') ?? '0',
    });

    const data = {
      name: input.name,
      relation: input.relation,
      designation: input.designation,
      phone: input.phone,
      altPhone: input.altPhone ?? null,
      email: input.email || null,
      sortOrder: input.sortOrder,
    };

    if (contactId) {
      const owned = await prisma.emergencyContact.findFirst({
        where: { id: contactId, residentId: user.residentId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw new NotFoundError('That contact could not be found.');

      await prisma.emergencyContact.update({ where: { id: contactId }, data });
      revalidatePath('/resident/emergency');
      return success('Emergency contact updated.');
    }

    await prisma.emergencyContact.create({
      data: { ...data, residentId: user.residentId, scope: 'RESIDENT_PERSONAL' },
    });

    revalidatePath('/resident/emergency');
    return success(`${input.name} added to your emergency contacts.`);
  });
}

export async function deleteEmergencyContactAction(contactId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireResident();

    const contact = await prisma.emergencyContact.findFirst({
      where: { id: contactId, residentId: user.residentId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!contact) throw new NotFoundError('That contact could not be found.');

    await prisma.emergencyContact.update({ where: { id: contact.id }, data: { deletedAt: new Date() } });

    revalidatePath('/resident/emergency');
    return success(`${contact.name} removed.`);
  });
}
