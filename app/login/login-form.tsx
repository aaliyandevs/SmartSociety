'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, SubmitButton, fieldErrors } from '@/components/shared/form';
import { loginAction } from '@/actions/auth-actions';
import { idleState } from '@/lib/action-result';
import { DEMO_ACCOUNTS } from '@/lib/demo-accounts';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, idleState);
  const [showPassword, setShowPassword] = React.useState(false);
  const [prefill, setPrefill] = React.useState<{ identifier: string; password: string } | null>(null);

  return (
    <div className="mt-7 space-y-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ''} />

        {state.status === 'error' ? (
          <Alert variant="destructive" title="Could not sign you in">
            {state.message}
          </Alert>
        ) : null}

        <Field label="Email or username" htmlFor="identifier" required errors={fieldErrors(state, 'identifier')}>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="admin@smartsociety.local"
            required
            defaultValue={prefill?.identifier}
            key={`identifier-${prefill?.identifier ?? ''}`}
            aria-invalid={fieldErrors(state, 'identifier') ? true : undefined}
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
              defaultValue={prefill?.password}
              key={`password-${prefill?.password ?? ''}`}
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

        <SubmitButton className="w-full" size="lg">
          Sign in
        </SubmitButton>
      </form>

      {/* Demo credentials — required as a submission deliverable (SRS §1.9). */}
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Demo accounts
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select a role to fill the form, then press Sign in.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto flex-col items-start gap-0.5 py-2 text-left"
              onClick={() => setPrefill({ identifier: account.email, password: account.password })}
            >
              <span className="text-xs font-semibold">{account.label}</span>
              <span className="max-w-full truncate text-[11px] font-normal text-muted-foreground">
                {account.email}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
