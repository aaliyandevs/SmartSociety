'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { updateSocietySettingsAction } from '@/actions/society-actions';
import { idleState } from '@/lib/action-result';

export interface SocietyDefaults {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  contactEmail: string;
  contactPhone: string;
  penaltyPercent: number;
  penaltyGraceDays: number;
  guidelines: string;
}

/**
 * One action updates the whole society record, so each tab renders the fields
 * it owns and carries the rest as hidden inputs. That keeps a partial save from
 * wiping the other tab's values.
 */
export function SocietySettingsForm({
  defaults,
  section,
}: {
  defaults: SocietyDefaults;
  section: 'society' | 'guidelines';
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateSocietySettingsAction, idleState);

  useActionFeedback(state, { onSuccess: () => router.refresh() });

  if (section === 'guidelines') {
    return (
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="name" value={defaults.name} />
        <input type="hidden" name="addressLine1" value={defaults.addressLine1} />
        <input type="hidden" name="addressLine2" value={defaults.addressLine2} />
        <input type="hidden" name="city" value={defaults.city} />
        <input type="hidden" name="state" value={defaults.state} />
        <input type="hidden" name="postalCode" value={defaults.postalCode} />
        <input type="hidden" name="contactEmail" value={defaults.contactEmail} />
        <input type="hidden" name="contactPhone" value={defaults.contactPhone} />
        <input type="hidden" name="penaltyPercent" value={defaults.penaltyPercent} />
        <input type="hidden" name="penaltyGraceDays" value={defaults.penaltyGraceDays} />

        {state.status === 'error' ? <Alert variant="destructive">{state.message}</Alert> : null}

        <Field
          label="House rules"
          htmlFor="guidelines"
          hint="Use # headings, - bullets and **bold** for structure"
          errors={fieldErrors(state, 'guidelines')}
        >
          <Textarea
            id="guidelines"
            name="guidelines"
            rows={22}
            maxLength={20000}
            defaultValue={defaults.guidelines}
            className="font-mono text-xs"
          />
        </Field>

        <div className="flex justify-end border-t border-border pt-4">
          <SubmitButton>Save guidelines</SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="guidelines" value={defaults.guidelines} />

      {state.status === 'error' && !state.fieldErrors ? (
        <Alert variant="destructive">{state.message}</Alert>
      ) : null}

      <Field label="Society name" htmlFor="name" required errors={fieldErrors(state, 'name')}>
        <Input id="name" name="name" required maxLength={120} defaultValue={defaults.name} />
      </Field>

      <FormGrid>
        <Field
          label="Address line 1"
          htmlFor="addressLine1"
          required
          errors={fieldErrors(state, 'addressLine1')}
        >
          <Input
            id="addressLine1"
            name="addressLine1"
            required
            maxLength={160}
            defaultValue={defaults.addressLine1}
          />
        </Field>
        <Field label="Address line 2" htmlFor="addressLine2" errors={fieldErrors(state, 'addressLine2')}>
          <Input
            id="addressLine2"
            name="addressLine2"
            maxLength={160}
            defaultValue={defaults.addressLine2}
          />
        </Field>
      </FormGrid>

      <FormGrid className="sm:grid-cols-3">
        <Field label="City" htmlFor="city" required errors={fieldErrors(state, 'city')}>
          <Input id="city" name="city" required maxLength={60} defaultValue={defaults.city} />
        </Field>
        <Field label="State" htmlFor="state" required errors={fieldErrors(state, 'state')}>
          <Input id="state" name="state" required maxLength={60} defaultValue={defaults.state} />
        </Field>
        <Field label="PIN code" htmlFor="postalCode" required errors={fieldErrors(state, 'postalCode')}>
          <Input
            id="postalCode"
            name="postalCode"
            required
            inputMode="numeric"
            maxLength={6}
            defaultValue={defaults.postalCode}
          />
        </Field>
      </FormGrid>

      <FormGrid>
        <Field
          label="Office email"
          htmlFor="contactEmail"
          required
          errors={fieldErrors(state, 'contactEmail')}
        >
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            defaultValue={defaults.contactEmail}
          />
        </Field>
        <Field
          label="Office phone"
          htmlFor="contactPhone"
          required
          errors={fieldErrors(state, 'contactPhone')}
        >
          <Input
            id="contactPhone"
            name="contactPhone"
            inputMode="numeric"
            required
            maxLength={10}
            defaultValue={defaults.contactPhone}
          />
        </Field>
      </FormGrid>

      <FormGrid>
        <Field
          label="Late payment penalty (%)"
          htmlFor="penaltyPercent"
          required
          hint="Applied to the invoice sub-total"
          errors={fieldErrors(state, 'penaltyPercent')}
        >
          <Input
            id="penaltyPercent"
            name="penaltyPercent"
            type="number"
            min={0}
            max={25}
            step="0.1"
            required
            defaultValue={defaults.penaltyPercent}
          />
        </Field>
        <Field
          label="Grace period (days)"
          htmlFor="penaltyGraceDays"
          required
          hint="Days after the due date before a penalty applies"
          errors={fieldErrors(state, 'penaltyGraceDays')}
        >
          <Input
            id="penaltyGraceDays"
            name="penaltyGraceDays"
            type="number"
            min={0}
            max={60}
            required
            defaultValue={defaults.penaltyGraceDays}
          />
        </Field>
      </FormGrid>

      <div className="flex justify-end border-t border-border pt-4">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
