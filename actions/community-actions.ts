'use server';

import { revalidatePath } from 'next/cache';

import { type ActionState, runAction, success } from '@/lib/action-result';
import { AUDIT_ACTIONS, auditActor, recordAudit } from '@/lib/audit';
import { requireResident, requireRole } from '@/lib/auth/session';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { notifyRoles } from '@/lib/notifications';
import prisma from '@/lib/prisma';
import { enforceRateLimit } from '@/lib/rate-limit';
import { humanise } from '@/lib/utils';
import {
  emergencyAlertSchema,
  noticeSchema,
  pollSchema,
  pollStatusSchema,
  resolveAlertSchema,
  voteSchema,
} from '@/lib/validations/communication';
import { castVote, resolveAlert } from '@/services/community-service';

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

const checkbox = (formData: FormData, key: string) =>
  formData.get(key) === 'on' || formData.get(key) === 'true';

// ── Notices ───────────────────────────────────────────────────────────────────

export async function saveNoticeAction(
  _prev: ActionState<{ noticeId: string }>,
  formData: FormData,
): Promise<ActionState<{ noticeId: string }>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const noticeId = formValue(formData, 'noticeId');

    const input = noticeSchema.parse({
      title: formValue(formData, 'title'),
      content: formValue(formData, 'content'),
      category: formValue(formData, 'category'),
      priority: formValue(formData, 'priority'),
      audience: formValue(formData, 'audience'),
      publishAt: formValue(formData, 'publishAt'),
      expiresAt: formValue(formData, 'expiresAt') ?? '',
      eventDate: formValue(formData, 'eventDate') ?? '',
      eventLocation: formValue(formData, 'eventLocation'),
      isPinned: checkbox(formData, 'isPinned'),
      isPublished: checkbox(formData, 'isPublished'),
    });

    const data = {
      title: input.title,
      content: input.content,
      category: input.category,
      priority: input.priority,
      audience: input.audience,
      publishAt: input.publishAt,
      expiresAt: input.expiresAt,
      eventDate: input.eventDate,
      eventLocation: input.eventLocation,
      isPinned: input.isPinned,
      isPublished: input.isPublished,
    };

    if (noticeId) {
      const existing = await prisma.notice.findFirst({
        where: { id: noticeId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw new NotFoundError('That notice could not be found.');

      const updated = await prisma.notice.update({ where: { id: noticeId }, data });

      await recordAudit({
        action: AUDIT_ACTIONS.NOTICE_UPDATED,
        entityType: 'Notice',
        entityId: updated.id,
        description: `Updated notice "${updated.title}".`,
        actor: auditActor(user),
      });

      revalidatePath('/admin/notices');
      revalidatePath('/resident/notices');
      return success('Notice updated.', { noticeId: updated.id });
    }

    const created = await prisma.notice.create({ data: { ...data, authorId: user.id } });

    await recordAudit({
      action: AUDIT_ACTIONS.NOTICE_CREATED,
      entityType: 'Notice',
      entityId: created.id,
      description: `Published notice "${created.title}" (${humanise(created.category)}, ${humanise(created.priority)}).`,
      actor: auditActor(user),
    });

    if (created.isPublished && created.publishAt <= new Date()) {
      await notifyRoles(
        created.audience === 'STAFF' ? ['GUARD', 'MAINTENANCE_STAFF'] : ['RESIDENT'],
        {
          type: 'NOTICE_PUBLISHED',
          title: 'New notice on the board',
          body: created.title,
          link: created.audience === 'STAFF' ? '/staff/notices' : '/resident/notices',
          entityType: 'Notice',
          entityId: created.id,
          isUrgent: created.priority === 'URGENT',
        },
      );
    }

    revalidatePath('/admin/notices');
    revalidatePath('/resident/notices');
    return success('Notice published.', { noticeId: created.id });
  });
}

export async function deleteNoticeAction(noticeId: string): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');

    const notice = await prisma.notice.findFirst({
      where: { id: noticeId, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!notice) throw new NotFoundError('That notice could not be found.');

    // Soft delete keeps the record for the audit trail.
    await prisma.notice.update({
      where: { id: notice.id },
      data: { deletedAt: new Date(), isPublished: false },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.NOTICE_DELETED,
      entityType: 'Notice',
      entityId: notice.id,
      description: `Removed notice "${notice.title}" from the board.`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/notices');
    revalidatePath('/resident/notices');
    return success('Notice removed from the board.');
  });
}

// ── Polls ─────────────────────────────────────────────────────────────────────

export async function savePollAction(
  _prev: ActionState<{ pollId: string }>,
  formData: FormData,
): Promise<ActionState<{ pollId: string }>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const pollId = formValue(formData, 'pollId');

    const input = pollSchema.parse({
      title: formValue(formData, 'title'),
      description: formValue(formData, 'description'),
      options: formData.getAll('options').map(String).filter((option) => option.trim().length > 0),
      startsAt: formValue(formData, 'startsAt'),
      endsAt: formValue(formData, 'endsAt'),
      isAnonymous: checkbox(formData, 'isAnonymous'),
      showLiveResults: checkbox(formData, 'showLiveResults'),
      status: formValue(formData, 'status') ?? 'ACTIVE',
    });

    if (pollId) {
      const existing = await prisma.poll.findFirst({
        where: { id: pollId, deletedAt: null },
        include: { _count: { select: { votes: true } } },
      });
      if (!existing) throw new NotFoundError('That poll could not be found.');

      // Changing options after voting starts would invalidate the tally.
      if (existing._count.votes > 0) {
        const updated = await prisma.poll.update({
          where: { id: pollId },
          data: {
            title: input.title,
            description: input.description,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            showLiveResults: input.showLiveResults,
            status: input.status,
          },
        });

        await recordAudit({
          action: AUDIT_ACTIONS.POLL_UPDATED,
          entityType: 'Poll',
          entityId: updated.id,
          description: `Updated poll "${updated.title}" (options locked — ${existing._count.votes} votes already cast).`,
          actor: auditActor(user),
        });

        revalidatePath('/admin/polls');
        revalidatePath('/resident/polls');
        return success('Poll updated. Options were left unchanged because votes have been cast.', {
          pollId: updated.id,
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.pollOption.deleteMany({ where: { pollId } });
        return tx.poll.update({
          where: { id: pollId },
          data: {
            title: input.title,
            description: input.description,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            isAnonymous: input.isAnonymous,
            showLiveResults: input.showLiveResults,
            status: input.status,
            options: {
              create: input.options.map((label, index) => ({ label, sortOrder: index })),
            },
          },
        });
      });

      await recordAudit({
        action: AUDIT_ACTIONS.POLL_UPDATED,
        entityType: 'Poll',
        entityId: updated.id,
        description: `Updated poll "${updated.title}".`,
        actor: auditActor(user),
      });

      revalidatePath('/admin/polls');
      revalidatePath('/resident/polls');
      return success('Poll updated.', { pollId: updated.id });
    }

    const created = await prisma.poll.create({
      data: {
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isAnonymous: input.isAnonymous,
        showLiveResults: input.showLiveResults,
        status: input.status,
        authorId: user.id,
        options: { create: input.options.map((label, index) => ({ label, sortOrder: index })) },
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.POLL_CREATED,
      entityType: 'Poll',
      entityId: created.id,
      description: `Created poll "${created.title}" with ${input.options.length} options.`,
      actor: auditActor(user),
    });

    if (created.status === 'ACTIVE') {
      await notifyRoles(['RESIDENT'], {
        type: 'POLL_OPENED',
        title: 'New community poll',
        body: `${created.title} — voting closes ${created.endsAt.toLocaleDateString('en-IN')}.`,
        link: '/resident/polls',
        entityType: 'Poll',
        entityId: created.id,
      });
    }

    revalidatePath('/admin/polls');
    revalidatePath('/resident/polls');
    return success('Poll created.', { pollId: created.id });
  });
}

export async function setPollStatusAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const input = pollStatusSchema.parse({
      pollId: formValue(formData, 'pollId'),
      status: formValue(formData, 'status'),
    });

    const poll = await prisma.poll.findFirst({
      where: { id: input.pollId, deletedAt: null },
      select: { id: true, title: true, status: true },
    });
    if (!poll) throw new NotFoundError('That poll could not be found.');
    if (poll.status === input.status) {
      throw new ConflictError(`This poll is already ${input.status.toLowerCase()}.`);
    }

    await prisma.poll.update({ where: { id: poll.id }, data: { status: input.status } });

    await recordAudit({
      action: AUDIT_ACTIONS.POLL_UPDATED,
      entityType: 'Poll',
      entityId: poll.id,
      description: `Changed poll "${poll.title}" from ${poll.status} to ${input.status}.`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/polls');
    revalidatePath('/resident/polls');
    return success(`Poll ${input.status.toLowerCase()}.`);
  });
}

export async function voteAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireResident();
    enforceRateLimit(`vote:${user.id}`, 30, 300);

    const input = voteSchema.parse({
      pollId: formValue(formData, 'pollId'),
      optionId: formValue(formData, 'optionId'),
    });

    const { pollTitle, optionLabel } = await castVote({
      pollId: input.pollId,
      optionId: input.optionId,
      residentId: user.residentId,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.POLL_VOTED,
      entityType: 'Poll',
      entityId: input.pollId,
      // The choice itself is not logged — polls are anonymous by default.
      description: `Cast a vote in poll "${pollTitle}".`,
      actor: auditActor(user),
    });

    revalidatePath('/resident/polls');
    revalidatePath('/resident');
    revalidatePath('/admin/polls');

    return success(`Your vote for "${optionLabel}" has been recorded.`);
  });
}

// ── Emergency alerts ──────────────────────────────────────────────────────────

export async function broadcastAlertAction(
  _prev: ActionState<{ alertId: string }>,
  formData: FormData,
): Promise<ActionState<{ alertId: string }>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    enforceRateLimit(`alert:${user.id}`, 10, 600);

    const input = emergencyAlertSchema.parse({
      type: formValue(formData, 'type'),
      severity: formValue(formData, 'severity'),
      title: formValue(formData, 'title'),
      message: formValue(formData, 'message'),
      instructions: formValue(formData, 'instructions'),
      targetBlockId: formValue(formData, 'targetBlockId') ?? '',
      sirenEnabled: checkbox(formData, 'sirenEnabled'),
    });

    const alert = await prisma.emergencyAlert.create({
      data: {
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        instructions: input.instructions,
        targetBlockId: input.targetBlockId || null,
        sirenEnabled: input.sirenEnabled,
        raisedById: user.id,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.ALERT_BROADCAST,
      entityType: 'EmergencyAlert',
      entityId: alert.id,
      description: `Broadcast ${humanise(input.severity)} ${humanise(input.type)} alert: "${input.title}".`,
      metadata: { type: input.type, severity: input.severity, siren: input.sirenEnabled },
      actor: auditActor(user),
    });

    const recipients = await notifyRoles(['RESIDENT', 'GUARD', 'MAINTENANCE_STAFF', 'ADMIN'], {
      type: 'EMERGENCY_ALERT',
      title: input.title,
      body: input.message,
      link: '/account/notifications',
      entityType: 'EmergencyAlert',
      entityId: alert.id,
      isUrgent: true,
    });

    revalidatePath('/admin/alerts');
    revalidatePath('/guard/alerts');
    revalidatePath('/staff/alerts');

    return success(`Emergency alert broadcast to ${recipients} people.`, { alertId: alert.id });
  });
}

export async function resolveAlertAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireRole('ADMIN');
    const input = resolveAlertSchema.parse({
      alertId: formValue(formData, 'alertId'),
      resolutionNote: formValue(formData, 'resolutionNote'),
    });

    const alert = await resolveAlert({
      alertId: input.alertId,
      resolverId: user.id,
      note: input.resolutionNote,
    });

    await recordAudit({
      action: AUDIT_ACTIONS.ALERT_RESOLVED,
      entityType: 'EmergencyAlert',
      entityId: alert.id,
      description: `Resolved the alert "${alert.title}".`,
      actor: auditActor(user),
    });

    revalidatePath('/admin/alerts');
    revalidatePath('/guard/alerts');
    revalidatePath('/staff/alerts');

    return success('Alert marked as resolved. The banner will clear for everyone.');
  });
}
