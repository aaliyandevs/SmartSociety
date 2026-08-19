'use server';

import { revalidatePath } from 'next/cache';

import { type ActionState, runAction, success } from '@/lib/action-result';
import { AUDIT_ACTIONS, auditActor, recordAudit } from '@/lib/audit';
import { requireRole } from '@/lib/auth/session';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { notify } from '@/lib/notifications';
import prisma from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import {
  blockSchema,
  flatSchema,
  residentCreateSchema,
  residentOffboardSchema,
  residentUpdateSchema,
  societySettingsSchema,
  staffCreateSchema,
  staffUpdateSchema,
} from '@/lib/validations/society';
import {
  archiveFlat,
  createFlat,
  getSociety,
  offboardResident,
  onboardResident,
  onboardStaff,
  updateFlat,
  updateResident,
  updateStaff,
} from '@/services/society-service';

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

const checkbox = (formData: FormData, key: string) =>
  formData.get(key) === 'on' || formData.get(key) === 'true';

// ── Blocks & flats ────────────────────────────────────────────────────────────

export async function createBlockAction(
  _prev: ActionState<{ blockId: string }>,
  formData: FormData,
): Promise<ActionState<{ blockId: string }>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const society = await getSociety();

    const input = blockSchema.parse({
      name: formValue(formData, 'name'),
      label: formValue(formData, 'label'),
      totalFloors: formValue(formData, 'totalFloors'),
    });

    const duplicate = await prisma.block.findFirst({
      where: { societyId: society.id, name: input.name, deletedAt: null },
      select: { id: true },
    });
    if (duplicate) throw new ConflictError(`A block named "${input.name}" already exists.`);

    const block = await prisma.block.create({ data: { ...input, societyId: society.id } });

    await recordAudit({
      action: AUDIT_ACTIONS.FLAT_CREATED,
      entityType: 'Block',
      entityId: block.id,
      description: `Added block "${block.name}" with ${block.totalFloors} floors.`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/flats');
    return success(`Block ${block.name} added.`, { blockId: block.id });
  });
}

export async function saveFlatAction(
  _prev: ActionState<{ flatId: string }>,
  formData: FormData,
): Promise<ActionState<{ flatId: string }>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const flatId = formValue(formData, 'flatId');

    const input = flatSchema.parse({
      blockId: formValue(formData, 'blockId'),
      flatNumber: formValue(formData, 'flatNumber'),
      floor: formValue(formData, 'floor'),
      flatType: formValue(formData, 'flatType'),
      carpetAreaSqft: formValue(formData, 'carpetAreaSqft') || undefined,
      occupancyStatus: formValue(formData, 'occupancyStatus'),
      parkingSlots: formValue(formData, 'parkingSlots'),
      baseMaintenance: formValue(formData, 'baseMaintenance'),
    });

    if (flatId) {
      const flat = await updateFlat(flatId, {
        flatNumber: input.flatNumber,
        floor: input.floor,
        flatType: input.flatType,
        carpetAreaSqft: input.carpetAreaSqft ?? null,
        occupancyStatus: input.occupancyStatus,
        parkingSlots: input.parkingSlots,
        baseMaintenance: input.baseMaintenance,
      });

      await recordAudit({
        action: AUDIT_ACTIONS.FLAT_UPDATED,
        entityType: 'Flat',
        entityId: flat.id,
        description: `Updated flat ${flat.block.name}-${flat.flatNumber}.`,
        metadata: { baseMaintenance: input.baseMaintenance, occupancy: input.occupancyStatus },
        actor: auditActor(user),
      });

      revalidatePath('/admin/flats');
      return success(`Flat ${flat.block.name}-${flat.flatNumber} updated.`, { flatId: flat.id });
    }

    const flat = await createFlat(input);

    await recordAudit({
      action: AUDIT_ACTIONS.FLAT_CREATED,
      entityType: 'Flat',
      entityId: flat.id,
      description: `Created flat ${flat.block.name}-${flat.flatNumber}.`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/flats');
    return success(`Flat ${flat.block.name}-${flat.flatNumber} created.`, { flatId: flat.id });
  });
}

export async function archiveFlatAction(flatId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const flat = await archiveFlat(flatId);

    await recordAudit({
      action: AUDIT_ACTIONS.FLAT_DELETED,
      entityType: 'Flat',
      entityId: flat.id,
      description: `Archived flat ${flat.block.name}-${flat.flatNumber}.`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/flats');
    return success(`Flat ${flat.block.name}-${flat.flatNumber} archived.`);
  });
}

// ── Residents ─────────────────────────────────────────────────────────────────

export async function onboardResidentAction(
  _prev: ActionState<{ residentId: string; temporaryPassword: string | null }>,
  formData: FormData,
): Promise<ActionState<{ residentId: string; temporaryPassword: string | null }>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const input = residentCreateSchema.parse({
      fullName: formValue(formData, 'fullName'),
      email: formValue(formData, 'email'),
      phone: formValue(formData, 'phone'),
      flatId: formValue(formData, 'flatId'),
      residentType: formValue(formData, 'residentType'),
      isPrimary: checkbox(formData, 'isPrimary'),
      moveInDate: formValue(formData, 'moveInDate'),
      occupation: formValue(formData, 'occupation'),
      alternatePhone: formValue(formData, 'alternatePhone') ?? '',
      password: formValue(formData, 'password') ?? '',
    });

    const result = await onboardResident({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      flatId: input.flatId,
      residentType: input.residentType,
      isPrimary: input.isPrimary,
      moveInDate: input.moveInDate,
      occupation: input.occupation,
      alternatePhone: input.alternatePhone,
      password: input.password || null,
    });

    const flat = await prisma.flat.findUnique({
      where: { id: input.flatId },
      select: { flatNumber: true, block: { select: { name: true } } },
    });
    const flatLabel = flat ? `${flat.block.name}-${flat.flatNumber}` : 'the flat';

    await recordAudit({
      action: AUDIT_ACTIONS.RESIDENT_CREATED,
      entityType: 'ResidentProfile',
      entityId: result.residentId,
      description: `Onboarded ${input.fullName} as ${input.residentType.toLowerCase()} of flat ${flatLabel}.`,
      metadata: { email: input.email, flat: flatLabel, residentType: input.residentType },
      actor: auditActor(user),
    });

    await notify({
      userId: result.userId,
      type: 'SYSTEM',
      title: `Welcome to ${(await getSociety()).name}`,
      body: `Your SmartSociety account for flat ${flatLabel} is ready. Please change your password after logging in.`,
      link: '/account/security',
    });

    revalidatePath('/admin/residents');
    revalidatePath('/admin/flats');

    return success(
      result.temporaryPassword
        ? `${input.fullName} onboarded. Share the temporary password shown below — it will not be displayed again.`
        : `${input.fullName} onboarded to flat ${flatLabel}.`,
      { residentId: result.residentId, temporaryPassword: result.temporaryPassword },
    );
  });
}

export async function updateResidentAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const input = residentUpdateSchema.parse({
      residentId: formValue(formData, 'residentId'),
      fullName: formValue(formData, 'fullName'),
      phone: formValue(formData, 'phone'),
      flatId: formValue(formData, 'flatId'),
      residentType: formValue(formData, 'residentType'),
      isPrimary: checkbox(formData, 'isPrimary'),
      moveInDate: formValue(formData, 'moveInDate'),
      occupation: formValue(formData, 'occupation'),
      alternatePhone: formValue(formData, 'alternatePhone') ?? '',
      status: formValue(formData, 'status'),
    });

    const resident = await updateResident({
      residentId: input.residentId,
      fullName: input.fullName,
      phone: input.phone,
      flatId: input.flatId,
      residentType: input.residentType,
      isPrimary: input.isPrimary,
      moveInDate: input.moveInDate,
      occupation: input.occupation,
      alternatePhone: input.alternatePhone,
      status: input.status,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.RESIDENT_UPDATED,
      entityType: 'ResidentProfile',
      entityId: resident.id,
      description: `Updated resident ${input.fullName} (flat ${resident.flat.block.name}-${resident.flat.flatNumber}).`,
      metadata: { status: input.status, residentType: input.residentType },
      actor: auditActor(user),
    });

    revalidatePath('/admin/residents');
    revalidatePath('/admin/flats');
    return success('Resident details updated.');
  });
}

export async function offboardResidentAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const input = residentOffboardSchema.parse({
      residentId: formValue(formData, 'residentId'),
      moveOutDate: formValue(formData, 'moveOutDate'),
      reason: formValue(formData, 'reason'),
    });

    const result = await offboardResident({
      residentId: input.residentId,
      moveOutDate: input.moveOutDate,
      reason: input.reason,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.RESIDENT_OFFBOARDED,
      entityType: 'ResidentProfile',
      entityId: input.residentId,
      description: `Offboarded ${result.resident.user.fullName} from flat ${result.flatLabel} with effect from ${formatDate(input.moveOutDate)}.`,
      metadata: { reason: input.reason, openBills: result.openBills },
      actor: auditActor(user),
    });

    revalidatePath('/admin/residents');
    revalidatePath('/admin/flats');

    return success(
      result.openBills > 0
        ? `${result.resident.user.fullName} offboarded. Note: flat ${result.flatLabel} still has ${result.openBills} unsettled invoice(s).`
        : `${result.resident.user.fullName} offboarded from flat ${result.flatLabel}.`,
    );
  });
}

// ── Staff ─────────────────────────────────────────────────────────────────────

export async function onboardStaffAction(
  _prev: ActionState<{ staffId: string; temporaryPassword: string | null }>,
  formData: FormData,
): Promise<ActionState<{ staffId: string; temporaryPassword: string | null }>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const input = staffCreateSchema.parse({
      fullName: formValue(formData, 'fullName'),
      email: formValue(formData, 'email'),
      phone: formValue(formData, 'phone'),
      role: formValue(formData, 'role'),
      department: formValue(formData, 'department'),
      designation: formValue(formData, 'designation'),
      shift: formValue(formData, 'shift'),
      gateAssignment: formValue(formData, 'gateAssignment'),
      skills: (formValue(formData, 'skills') ?? '')
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
      password: formValue(formData, 'password') ?? '',
    });

    const result = await onboardStaff({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      role: input.role,
      department: input.department,
      designation: input.designation,
      shift: input.shift,
      gateAssignment: input.gateAssignment,
      skills: input.skills,
      password: input.password || null,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.STAFF_CREATED,
      entityType: 'StaffProfile',
      entityId: result.staff.id,
      description: `Added ${input.fullName} as ${input.designation} (${input.role}).`,
      metadata: { email: input.email, department: input.department },
      actor: auditActor(user),
    });

    revalidatePath('/admin/staff');

    return success(
      result.temporaryPassword
        ? `${input.fullName} added. Share the temporary password shown below — it will not be displayed again.`
        : `${input.fullName} added to the staff directory.`,
      { staffId: result.staff.id, temporaryPassword: result.temporaryPassword },
    );
  });
}

export async function updateStaffAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const input = staffUpdateSchema.parse({
      staffId: formValue(formData, 'staffId'),
      fullName: formValue(formData, 'fullName'),
      phone: formValue(formData, 'phone'),
      department: formValue(formData, 'department'),
      designation: formValue(formData, 'designation'),
      shift: formValue(formData, 'shift'),
      gateAssignment: formValue(formData, 'gateAssignment'),
      skills: (formValue(formData, 'skills') ?? '')
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
      status: formValue(formData, 'status'),
    });

    const staff = await updateStaff({
      staffId: input.staffId,
      fullName: input.fullName,
      phone: input.phone,
      department: input.department,
      designation: input.designation,
      shift: input.shift,
      gateAssignment: input.gateAssignment,
      skills: input.skills,
      status: input.status,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.STAFF_UPDATED,
      entityType: 'StaffProfile',
      entityId: staff.id,
      description: `Updated staff member ${input.fullName} (${input.designation}).`,
      metadata: { status: input.status },
      actor: auditActor(user),
    });

    revalidatePath('/admin/staff');
    return success('Staff details updated.');
  });
}

// ── Society settings ──────────────────────────────────────────────────────────

export async function updateSocietySettingsAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const society = await getSociety();

    const input = societySettingsSchema.parse({
      name: formValue(formData, 'name'),
      addressLine1: formValue(formData, 'addressLine1'),
      addressLine2: formValue(formData, 'addressLine2'),
      city: formValue(formData, 'city'),
      state: formValue(formData, 'state'),
      postalCode: formValue(formData, 'postalCode'),
      contactEmail: formValue(formData, 'contactEmail'),
      contactPhone: formValue(formData, 'contactPhone'),
      guidelines: formValue(formData, 'guidelines'),
      penaltyPercent: formValue(formData, 'penaltyPercent'),
      penaltyGraceDays: formValue(formData, 'penaltyGraceDays'),
    });

    await prisma.society.update({ where: { id: society.id }, data: input });

    await recordAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'Society',
      entityId: society.id,
      description: 'Updated society settings.',
      metadata: {
        penaltyPercent: input.penaltyPercent,
        penaltyGraceDays: input.penaltyGraceDays,
      },
      actor: auditActor(user),
    });

    revalidatePath('/admin/settings');
    revalidatePath('/resident/guidelines');
    return success('Society settings saved.');
  });
}

/** Adds or updates an entry in the society-wide emergency directory. */
export async function saveDirectoryContactAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const contactId = formValue(formData, 'contactId');

    const data = {
      name: (formValue(formData, 'name') ?? '').trim(),
      designation: formValue(formData, 'designation')?.trim() || null,
      phone: (formValue(formData, 'phone') ?? '').trim(),
      altPhone: formValue(formData, 'altPhone')?.trim() || null,
      sortOrder: Number(formValue(formData, 'sortOrder') ?? 0) || 0,
      scope: 'SOCIETY_DIRECTORY' as const,
    };

    if (data.name.length < 2) {
      return { status: 'error' as const, message: 'Enter a contact name.', fieldErrors: { name: ['Enter a contact name.'] } };
    }
    if (!/^[6-9]\d{9}$/.test(data.phone)) {
      return {
        status: 'error' as const,
        message: 'Enter a valid 10-digit phone number.',
        fieldErrors: { phone: ['Enter a valid 10-digit phone number.'] },
      };
    }

    if (contactId) {
      const existing = await prisma.emergencyContact.findFirst({
        where: { id: contactId, scope: 'SOCIETY_DIRECTORY', deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw new NotFoundError('That directory entry could not be found.');
      await prisma.emergencyContact.update({ where: { id: contactId }, data });
    } else {
      await prisma.emergencyContact.create({ data });
    }

    await recordAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'EmergencyContact',
      entityId: contactId ?? null,
      description: `${contactId ? 'Updated' : 'Added'} emergency directory entry "${data.name}".`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/settings');
    revalidatePath('/resident/emergency');
    revalidatePath('/guard/directory');
    return success(contactId ? 'Directory entry updated.' : 'Directory entry added.');
  });
}

export async function deleteDirectoryContactAction(contactId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const contact = await prisma.emergencyContact.findFirst({
      where: { id: contactId, scope: 'SOCIETY_DIRECTORY', deletedAt: null },
      select: { id: true, name: true },
    });
    if (!contact) throw new NotFoundError('That directory entry could not be found.');

    await prisma.emergencyContact.update({ where: { id: contact.id }, data: { deletedAt: new Date() } });

    await recordAudit({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'EmergencyContact',
      entityId: contact.id,
      description: `Removed emergency directory entry "${contact.name}".`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/settings');
    revalidatePath('/resident/emergency');
    revalidatePath('/guard/directory');
    return success('Directory entry removed.');
  });
}
