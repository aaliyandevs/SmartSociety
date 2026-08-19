'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ActionState } from '@/lib/action-result';

/** Submit button that automatically shows a spinner while the action runs. */
export function SubmitButton({
  children,
  loading,
  loadingText,
  ...props
}: ButtonProps & { loadingText?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending || loading} {...props}>
      {pending && loadingText ? loadingText : children}
    </Button>
  );
}

/** Field-level validation message returned by a server action. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="text-xs font-medium text-destructive" role="alert">
      {messages[0]}
    </p>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  errors?: string[];
  className?: string;
  children: React.ReactNode;
}

/** Consistent label + control + hint + error layout for every form. */
export function Field({ label, htmlFor, hint, required, errors, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {/*
        The required marker sits outside the <label> on purpose: keeping it in
        would make the label's text "Name*", which is what assistive technology
        and label-based test queries read. The `required` attribute on the input
        is what actually announces the requirement.
      */}
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </div>
      {children}
      {hint && !errors?.length ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError messages={errors} />
    </div>
  );
}

export function FormGrid({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)} {...props} />;
}

/**
 * Surfaces an action result as a toast exactly once per state change, and
 * optionally runs a callback on success (close a dialog, reset a form, ...).
 */
export function useActionFeedback<T>(
  state: ActionState<T>,
  options: { onSuccess?: (data?: T) => void; onError?: (message: string) => void } = {},
) {
  const { onSuccess, onError } = options;
  const handled = React.useRef<ActionState<T> | null>(null);

  React.useEffect(() => {
    if (state.status === 'idle' || handled.current === state) return;
    handled.current = state;

    if (state.status === 'success') {
      toast.success(state.message);
      onSuccess?.(state.data);
    } else {
      toast.error(state.message);
      onError?.(state.message);
    }
    // `onSuccess`/`onError` are intentionally excluded: callers usually pass
    // inline closures, and re-running on every render would double-fire toasts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

/** Reads field errors out of an action state without null-checking everywhere. */
export function fieldErrors<T>(state: ActionState<T>, name: string): string[] | undefined {
  return state.status === 'error' ? state.fieldErrors?.[name] : undefined;
}

/** Non-field ("_form") level error message. */
export function formError<T>(state: ActionState<T>): string | null {
  if (state.status !== 'error') return null;
  return state.fieldErrors?._form?.[0] ?? state.message;
}
