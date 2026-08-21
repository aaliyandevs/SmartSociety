'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Field, SubmitButton, fieldErrors, useFormValues } from '@/components/shared/form';
import { loginAction } from '@/actions/auth-actions';
import { idleState } from '@/lib/action-result';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, idleState);
  const [showPassword, setShowPassword] = React.useState(false);
  // The password is meant to clear on a failed attempt; the identifier isn't
  // — nobody wants to retype their email every time they fat-finger a
  // password (see components/shared/form.tsx for why this is needed at all).
  const identifier = useFormValues(state, { identifier: '' });

  return (
    <div className="mt-7 space-y-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ''} />

        {state.status === 'error' ? (
          <Alert variant="destructive" title="Could not sign you in">
            {state.message}
          </Alert>
        ) : null}

        <Field label="Email or username" htmlFor="identifier" required errors={identifier.errors('identifier')}>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            required
            value={identifier.values.identifier}
            onChange={(e) => identifier.set('identifier', e.target.value)}
            aria-invalid={identifier.errors('identifier') ? true : undefined}
          />
        </Field>

        <Field label="Password" htmlFor="password" required errors={fieldErrors(state, 'password')}>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className="pr-10"
              aria-invalid={fieldErrors(state, 'password') ? true : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <SubmitButton className="w-full" size="lg" loadingText="Logging in…">
          Login
        </SubmitButton>
      </form>
    </div>
  );
}
