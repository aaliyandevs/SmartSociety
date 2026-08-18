'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Briefcase, Car, Package, User, Wrench } from 'lucide-react';

import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { createGatePassAction } from '@/actions/gate-actions';
import { idleState } from '@/lib/action-result';
import { cn, toDateTimeInputValue } from '@/lib/utils';

const VISITOR_TYPES = [
  { value: 'GUEST', label: 'Guest', icon: User, hint: 'Friends and family' },
  { value: 'DELIVERY', label: 'Delivery', icon: Package, hint: 'Courier or food' },
  { value: 'CAB', label: 'Cab', icon: Car, hint: 'Taxi or ride-hail' },
  { value: 'VENDOR', label: 'Vendor', icon: Briefcase, hint: 'Service company' },
  { value: 'SERVICE', label: 'Service', icon: Wrench, hint: 'Technician or help' },
  { value: 'OTHER', label: 'Other', icon: Bike, hint: 'Anything else' },
] as const;

/** Sensible default window: from now until four hours later. */
function defaultWindow() {
  const from = new Date();
  const until = new Date(from.getTime() + 4 * 3_600_000);
  return { from: toDateTimeInputValue(from), until: toDateTimeInputValue(until) };
}

export function GatePassForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(createGatePassAction, idleState);
  const [visitorType, setVisitorType] = React.useState<string>('GUEST');
  const [window] = React.useState(defaultWindow);

  useActionFeedback(state, {
    onSuccess: (data) => {
      if (data?.passId) router.push(`/resident/visitors/${data.passId}`);
    },
  });

  const needsCompany = visitorType === 'DELIVERY' || visitorType === 'VENDOR' || visitorType === 'CAB';

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && !state.fieldErrors ? (
        <Alert variant="destructive" title="Could not create the pass">
          {state.message}
        </Alert>
      ) : null}

      {/* Visitor type picker — large targets, works on a phone. */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Visitor type</legend>
        <input type="hidden" name="visitorType" value={visitorType} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {VISITOR_TYPES.map((type) => {
            const Icon = type.icon;
            const selected = visitorType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setVisitorType(type.value)}
                aria-pressed={selected}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border hover:bg-accent/60',
                )}
              >
                <Icon className="size-4.5 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{type.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{type.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <FormGrid>
        <Field
          label="Visitor name"
          htmlFor="visitorName"
          required
          errors={fieldErrors(state, 'visitorName')}
        >
          <Input id="visitorName" name="visitorName" placeholder="Ahmed Raza" required maxLength={80} />
        </Field>

        <Field
          label="Mobile number"
          htmlFor="visitorPhone"
          required
          hint="11-digit Pakistani mobile number"
          errors={fieldErrors(state, 'visitorPhone')}
        >
          <Input
            id="visitorPhone"
            name="visitorPhone"
            inputMode="numeric"
            placeholder="03001234567"
            required
            maxLength={11}
          />
        </Field>
      </FormGrid>

      <FormGrid>
        <Field
          label="Vehicle number"
          htmlFor="vehicleNumber"
          hint="Optional — helps the guard at the barrier"
          errors={fieldErrors(state, 'vehicleNumber')}
        >
          <Input
            id="vehicleNumber"
            name="vehicleNumber"
            placeholder="LEA1234"
            className="uppercase"
            maxLength={14}
          />
        </Field>

        {needsCompany ? (
          <Field label="Company" htmlFor="company" errors={fieldErrors(state, 'company')}>
            <Input id="company" name="company" placeholder="Amazon, Uber, Godrej…" maxLength={80} />
          </Field>
        ) : (
          <Field
            label="Number of entries"
            htmlFor="maxEntries"
            hint="Use more than one for a vendor visiting repeatedly"
            errors={fieldErrors(state, 'maxEntries')}
          >
            <Select name="maxEntries" defaultValue="1">
              <SelectTrigger id="maxEntries">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 5, 10].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} {count === 1 ? 'entry' : 'entries'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </FormGrid>

      {needsCompany ? (
        <Field
          label="Number of entries"
          htmlFor="maxEntriesAlt"
          hint="Use more than one for a vendor visiting repeatedly"
          errors={fieldErrors(state, 'maxEntries')}
        >
          <Select name="maxEntries" defaultValue="1">
            <SelectTrigger id="maxEntriesAlt" className="sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 5, 10].map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count} {count === 1 ? 'entry' : 'entries'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <FormGrid>
        <Field
          label="Valid from"
          htmlFor="validFrom"
          required
          errors={fieldErrors(state, 'validFrom')}
        >
          <Input
            id="validFrom"
            name="validFrom"
            type="datetime-local"
            defaultValue={window.from}
            required
          />
        </Field>

        <Field
          label="Valid until"
          htmlFor="validUntil"
          required
          errors={fieldErrors(state, 'validUntil')}
        >
          <Input
            id="validUntil"
            name="validUntil"
            type="datetime-local"
            defaultValue={window.until}
            required
          />
        </Field>
      </FormGrid>

      <Field
        label="Purpose of visit"
        htmlFor="purpose"
        hint="Optional — shown to the guard"
        errors={fieldErrors(state, 'purpose')}
      >
        <Textarea
          id="purpose"
          name="purpose"
          placeholder="Weekend guests staying over, furniture delivery, AC servicing…"
          rows={3}
          maxLength={200}
        />
      </Field>

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <SubmitButton size="lg">Create pass</SubmitButton>
      </div>
    </form>
  );
}
