'use client';

import * as React from 'react';
import { useActionState } from 'react';

import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Field, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { changePasswordAction } from '@/actions/auth-actions';
import { idleState } from '@/lib/action-result';
import { cn } from '@/lib/utils';

const RULES = [
  { test: (value: string) => value.length >= 8, label: 'At least 8 characters' },
  { test: (value: string) => /[A-Z]/.test(value), label: 'One uppercase letter' },
  { test: (value: string) => /[a-z]/.test(value), label: 'One lowercase letter' },
  { test: (value: string) => /\d/.test(value), label: 'One number' },
];

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, idleState);
  const [password, setPassword] = React.useState('');
  const formRef = React.useRef<HTMLFormElement>(null);

  useActionFeedback(state, {
    onSuccess: () => {
      setPassword('');
      formRef.current?.reset();
    },
  });

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {state.status === 'error' && !state.fieldErrors ? (
        <Alert variant="destructive" title="Could not change your password">
          {state.message}
        </Alert>
      ) : null}

      <Field
        label="Current password"
        htmlFor="currentPassword"
        required
        errors={fieldErrors(state, 'currentPassword')}
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        required
        errors={fieldErrors(state, 'newPassword')}
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {RULES.map((rule) => {
          const passed = rule.test(password);
          return (
            <li
              key={rule.label}
              className={cn(
                'flex items-center gap-2 text-xs',
                passed ? 'text-success' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-3.5 items-center justify-center rounded-full border text-[9px]',
                  passed ? 'border-success bg-success text-success-foreground' : 'border-border',
                )}
                aria-hidden
              >
                {passed ? '✓' : ''}
              </span>
              {rule.label}
            </li>
          );
        })}
      </ul>

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        required
        errors={fieldErrors(state, 'confirmPassword')}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>

      <div className="flex justify-end border-t border-border pt-4">
        <SubmitButton>Update password</SubmitButton>
      </div>
    </form>
  );
}
