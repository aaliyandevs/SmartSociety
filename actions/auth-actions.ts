'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { type ActionState, runAction, success } from '@/lib/action-result';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { createSession, destroySession, requestContext, requireUser } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { resolveLoginDestination } from '@/lib/rbac';
import { changePasswordSchema, loginSchema } from '@/lib/validations/auth';
import { authenticate, changePassword } from '@/services/auth-service';

/**
 * Sign in.
 *
 * On success this throws a Next.js redirect, so the caller never sees a
 * "success" state — that is intentional and keeps the credential out of the
 * client-side action result.
 */
export async function loginAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  // redirect() throws, so it has to happen *after* runAction returns.
  const outcome = { destination: '/' };

  const result = await runAction<never>(async () => {
    const input = loginSchema.parse({
      identifier: formData.get('identifier'),
      password: formData.get('password'),
      next: formData.get('next') ?? undefined,
    });

    const { ipAddress } = await requestContext();
    // Two windows: a tight per-account limit and a looser per-IP limit.
    enforceRateLimit(`login:id:${input.identifier.toLowerCase()}`, 8, 300);
    enforceRateLimit(`login:ip:${ipAddress ?? 'unknown'}`, 25, 300);

    const user = await authenticate(input.identifier, input.password);
    await createSession(user);

    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      entityType: 'User',
      entityId: user.id,
      description: `${user.fullName} signed in as ${user.role}.`,
      actor: { id: user.id, name: user.fullName, role: user.role },
    });

    outcome.destination = resolveLoginDestination(user.role, input.next);

    return success('Signed in.');
  });

  if (result.status === 'error') return result;
  redirect(outcome.destination);
}

export async function logoutAction(): Promise<void> {
  const user = await requireUser().catch(() => null);

  if (user) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      entityType: 'User',
      entityId: user.id,
      description: `${user.fullName} signed out.`,
      actor: { id: user.id, name: user.fullName, role: user.role },
    });
  }

  await destroySession();
  redirect('/login');
}

export async function changePasswordAction(
  _prev: ActionState<never>,
  formData: FormData,
): Promise<ActionState<never>> {
  return runAction(async () => {
    const user = await requireUser();
    enforceRateLimit(`password:${user.id}`, 5, 600);

    const input = changePasswordSchema.parse({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    });

    await changePassword(user.id, input.currentPassword, input.newPassword);
    revalidatePath('/account');

    return success('Password updated. Other devices have been signed out.');
  });
}
