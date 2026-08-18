import { ZodError } from 'zod';

import { AppError, fromZodError, isNextControlFlowError } from '@/lib/errors';

/**
 * The single shape every server action returns. `useActionState` on the client
 * consumes it directly, which keeps form error handling identical everywhere.
 */
export type ActionState<TData = undefined> =
  | { status: 'idle' }
  | { status: 'success'; message: string; data?: TData }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string[]> };

export const idleState: ActionState<never> = { status: 'idle' };

export function success<TData>(message: string, data?: TData): ActionState<TData> {
  return { status: 'success', message, data };
}

export function failure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionState<never> {
  return { status: 'error', message, fieldErrors };
}

/**
 * Wraps a server action body so that:
 *   • Zod failures become field-level messages,
 *   • deliberate AppErrors become friendly messages,
 *   • anything else is logged server-side and reported generically,
 *   • Next.js redirect/notFound signals still propagate.
 */
export async function runAction<TData>(
  fn: () => Promise<ActionState<TData>>,
): Promise<ActionState<TData>> {
  try {
    return await fn();
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;

    if (error instanceof ZodError) {
      const validation = fromZodError(error);
      return failure(validation.message, validation.fieldErrors);
    }

    if (error instanceof AppError) {
      return failure(error.message, error.fieldErrors);
    }

    console.error('[server-action] Unhandled error:', error);
    return failure('Something went wrong on our side. Please try again.');
  }
}
