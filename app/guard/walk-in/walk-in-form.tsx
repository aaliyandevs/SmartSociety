'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Phone, Search } from 'lucide-react';

import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
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
import { logWalkInAction } from '@/actions/gate-actions';
import { idleState } from '@/lib/action-result';
import { cn, toDateTimeInputValue } from '@/lib/utils';

export interface FlatOption {
  id: string;
  label: string;
  resident: string;
  phone: string | null;
}

const VISITOR_TYPES = [
  { value: 'GUEST', label: 'Guest' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'CAB', label: 'Cab' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'OTHER', label: 'Other' },
];

export function WalkInForm({
  flats,
  gates,
  defaultGate,
}: {
  flats: FlatOption[];
  gates: string[];
  defaultGate: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(logWalkInAction, idleState);
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<FlatOption | null>(null);
  const [visitorType, setVisitorType] = React.useState('GUEST');

  useActionFeedback(state, {
    onSuccess: () => {
      setSelected(null);
      setQuery('');
      router.push('/guard');
    },
  });

  const matches = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return flats
      .filter(
        (flat) =>
          flat.label.toLowerCase().includes(term) || flat.resident.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [flats, query]);

  const defaultExit = toDateTimeInputValue(new Date(Date.now() + 3 * 3_600_000));

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && !state.fieldErrors ? (
        <Alert variant="destructive" title="Could not log the entry">
          {state.message}
        </Alert>
      ) : null}

      {/* ── Flat lookup ── */}
      <div className="space-y-1.5">
        <label htmlFor="flatSearch" className="text-sm font-medium">
          Which flat are they visiting? <span className="text-destructive">*</span>
        </label>
        <input type="hidden" name="flatId" value={selected?.id ?? ''} />

        {selected ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary bg-primary-soft p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Check className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Flat {selected.label}</span>
              <span className="block text-sm text-muted-foreground">{selected.resident}</span>
            </span>
            {selected.phone ? (
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${selected.phone}`}>
                  <Phone className="size-4" />
                  Call
                </a>
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="flatSearch"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a flat number or resident name, e.g. A-101 or Khan"
              className="h-12 pl-9"
              autoComplete="off"
            />

            {matches.length > 0 ? (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                {matches.map((flat) => (
                  <li key={flat.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(flat);
                        setQuery('');
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">Flat {flat.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {flat.resident}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : query.trim().length > 0 ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                No flat matches &ldquo;{query}&rdquo;.
              </p>
            ) : null}
          </div>
        )}
        {fieldErrors(state, 'flatId') ? (
          <p className="text-xs font-medium text-destructive">Select the flat being visited.</p>
        ) : null}
      </div>

      {/* ── Visitor type ── */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Visitor type</legend>
        <input type="hidden" name="visitorType" value={visitorType} />
        <div className="flex flex-wrap gap-2">
          {VISITOR_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setVisitorType(type.value)}
              aria-pressed={visitorType === type.value}
              className={cn(
                'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                visitorType === type.value
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border hover:bg-accent/60',
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </fieldset>

      <FormGrid>
        <Field label="Visitor name" htmlFor="name" required errors={fieldErrors(state, 'name')}>
          <Input id="name" name="name" required maxLength={80} className="h-12" />
        </Field>
        <Field label="Mobile number" htmlFor="phone" required errors={fieldErrors(state, 'phone')}>
          <Input
            id="phone"
            name="phone"
            inputMode="numeric"
            required
            maxLength={11}
            className="h-12"
            placeholder="03001234567"
          />
        </Field>
      </FormGrid>

      <FormGrid>
        <Field
          label="Vehicle number"
          htmlFor="vehicleNumber"
          errors={fieldErrors(state, 'vehicleNumber')}
        >
          <Input
            id="vehicleNumber"
            name="vehicleNumber"
            className="h-12 uppercase"
            maxLength={14}
            placeholder="LEA1234"
          />
        </Field>
        <Field
          label="Company"
          htmlFor="company"
          hint="For delivery, cab and vendor visits"
          errors={fieldErrors(state, 'company')}
        >
          <Input id="company" name="company" className="h-12" maxLength={80} placeholder="Amazon, Uber…" />
        </Field>
      </FormGrid>

      <FormGrid>
        <Field label="ID proof type" htmlFor="idProofType" errors={fieldErrors(state, 'idProofType')}>
          <Select name="idProofType">
            <SelectTrigger id="idProofType" className="h-12">
              <SelectValue placeholder="Not collected" />
            </SelectTrigger>
            <SelectContent>
              {['CNIC', 'Driving Licence', 'NICOP', 'NTN', 'Company ID', 'Passport'].map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="ID proof number"
          htmlFor="idProofNumber"
          hint="Record only the last four digits"
          errors={fieldErrors(state, 'idProofNumber')}
        >
          <Input id="idProofNumber" name="idProofNumber" className="h-12" maxLength={40} />
        </Field>
      </FormGrid>

      <FormGrid>
        <Field label="Gate" htmlFor="gate" required errors={fieldErrors(state, 'gate')}>
          <Select name="gate" defaultValue={defaultGate}>
            <SelectTrigger id="gate" className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gates.map((gate) => (
                <SelectItem key={gate} value={gate}>
                  {gate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Expected exit"
          htmlFor="expectedExitAt"
          hint="An overstay alert is raised after this time"
          errors={fieldErrors(state, 'expectedExitAt')}
        >
          <Input
            id="expectedExitAt"
            name="expectedExitAt"
            type="datetime-local"
            defaultValue={defaultExit}
            className="h-12"
          />
        </Field>
      </FormGrid>

      <Field label="Remarks" htmlFor="remarks" errors={fieldErrors(state, 'remarks')}>
        <Textarea
          id="remarks"
          name="remarks"
          rows={2}
          maxLength={200}
          placeholder="Resident confirmed on intercom."
        />
      </Field>

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <SubmitButton size="xl" disabled={!selected}>
          Record entry
        </SubmitButton>
      </div>
    </form>
  );
}
