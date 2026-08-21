'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button, type ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ActionState } from '@/lib/action-result';

/**
 * Masked password input with a show/hide toggle — the one the login page
 * already has. Use this anywhere a new password is typed instead of a plain
 * `<Input>`; a password an admin sets while onboarding someone shouldn't be
 * visible in plain text to whoever's standing at the counter.
 */
export function PasswordField({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

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

        The asterisk is always rendered (never conditionally mounted) and just
        toggles `invisible` — otherwise a required field's label row is a few
        pixels taller than an optional one right next to it in the same
        FormGrid row, and the two columns' inputs end up out of line with
        each other.
      */}
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        <span className={cn('text-destructive', !required && 'invisible')} aria-hidden>
          *
        </span>
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

/**
 * Keeps a server-action form's fields populated with what the visitor typed
 * even after a failed submission, and clears a field's error the moment they
 * edit it. Without this, every field in a `<form action={...}>` reverts to
 * its `defaultValue` after the action call resolves — success *or* failure —
 * which is React's own behaviour for uncontrolled fields in an action form,
 * not a bug in any one form here. Errors otherwise also only ever
 * re-evaluate on the next submit, so a field you've already fixed still
 * shows yesterday's message until you submit again.
 *
 * Use it for the fields worth protecting on a form (rather than every field
 * in the app) — typically anything on a dialog a failed submission would
 * otherwise force the person to retype.
 */
export function useFormValues<T extends Record<string, string | boolean>>(
  state: ActionState<unknown>,
  initial: T,
) {
  // Values and touched-ness live in one state object so a field can only be
  // marked touched in the same update that actually changes its value —
  // otherwise a browser re-applying an autofill suggestion that happens to
  // match what's already there (common once a form has any email/tel field
  // on it) would re-touch the field and quietly re-suppress its error.
  const [data, setData] = React.useState<{ values: T; touched: Record<string, boolean> }>({
    values: initial,
    touched: {},
  });

  // A fresh submission result — including a retried one — should show every
  // error in full again; only editing after *that* point should start
  // clearing them one field at a time.
  React.useEffect(() => {
    setData((d) => (Object.keys(d.touched).length === 0 ? d : { values: d.values, touched: {} }));
  }, [state]);

  const set = React.useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setData((d) => {
      if (d.values[name] === value) return d;
      return { values: { ...d.values, [name]: value }, touched: { ...d.touched, [name as string]: true } };
    });
  }, []);

  const reset = React.useCallback((next: T) => {
    setData({ values: next, touched: {} });
  }, []);

  const errors = React.useCallback(
    (name: string): string[] | undefined => (data.touched[name] ? undefined : fieldErrors(state, name)),
    [state, data.touched],
  );

  return { values: data.values, set, reset, errors };
}

/** Non-field ("_form") level error message. */
export function formError<T>(state: ActionState<T>): string | null {
  if (state.status !== 'error') return null;
  return state.fieldErrors?._form?.[0] ?? state.message;
}
