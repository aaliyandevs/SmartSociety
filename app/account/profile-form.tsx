'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { updateProfileAction } from '@/actions/profile-actions';
import { idleState } from '@/lib/action-result';

export function ProfileForm({
  defaults,
  showResidentFields,
}: {
  defaults: {
    fullName: string;
    email: string;
    phone: string;
    alternatePhone: string;
    occupation: string;
  };
  showResidentFields: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateProfileAction, idleState);

  useActionFeedback(state, { onSuccess: () => router.refresh() });

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && !state.fieldErrors ? (
        <Alert variant="destructive" title="Could not save your profile">
          {state.message}
        </Alert>
      ) : null}

      <FormGrid>
        <Field label="Full name" htmlFor="fullName" required errors={fieldErrors(state, 'fullName')}>
          <Input
            id="fullName"
            name="fullName"
            required
            maxLength={80}
            defaultValue={defaults.fullName}
            autoComplete="name"
          />
        </Field>

        <Field
          label="Email address"
          htmlFor="email"
          required
          hint="Used for sign-in and billing notifications"
          errors={fieldErrors(state, 'email')}
        >
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={defaults.email}
            autoComplete="email"
          />
        </Field>
      </FormGrid>

      <FormGrid>
        <Field label="Mobile number" htmlFor="phone" required errors={fieldErrors(state, 'phone')}>
          <Input
            id="phone"
            name="phone"
            inputMode="numeric"
            required
            maxLength={10}
            defaultValue={defaults.phone}
            autoComplete="tel"
          />
        </Field>

        {showResidentFields ? (
          <Field
            label="Alternate number"
            htmlFor="alternatePhone"
            hint="Reached if your primary number is unavailable"
            errors={fieldErrors(state, 'alternatePhone')}
          >
            <Input
              id="alternatePhone"
              name="alternatePhone"
              inputMode="numeric"
              maxLength={10}
              defaultValue={defaults.alternatePhone}
            />
          </Field>
        ) : null}
      </FormGrid>

      {showResidentFields ? (
        <Field label="Occupation" htmlFor="occupation" errors={fieldErrors(state, 'occupation')}>
          <Input
            id="occupation"
            name="occupation"
            maxLength={80}
            defaultValue={defaults.occupation}
            placeholder="Software Engineer"
          />
        </Field>
      ) : (
        <>
          <input type="hidden" name="alternatePhone" value="" />
          <input type="hidden" name="occupation" value="" />
        </>
      )}

      <div className="flex justify-end border-t border-border pt-4">
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}
