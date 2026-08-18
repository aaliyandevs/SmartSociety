'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, CheckCircle2, Clock, IndianRupee, MapPin, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { createBookingAction } from '@/actions/amenity-actions';
import { idleState } from '@/lib/action-result';
import { cn, formatCurrency } from '@/lib/utils';

export interface AmenityOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number;
  hours: string;
  slotMinutes: number;
  fee: number;
  feeLabel: string;
  requiresApproval: boolean;
  maxSlotsPerBooking: number;
  maxAdvanceDays: number;
  minCancelHours: number;
  isActive: boolean;
}

export interface SlotView {
  startsAt: string;
  label: string;
  endLabel: string;
  available: boolean;
  bookedBy: string | null;
  isPast: boolean;
  mine: boolean;
}

/**
 * Availability grid + booking form.
 *
 * The amenity and date live in the URL so the server renders real availability;
 * only slot selection is local state.
 */
export function AmenityBooking({
  amenities,
  selectedSlug,
  date,
  slots,
}: {
  amenities: AmenityOption[];
  selectedSlug: string;
  date: string;
  slots: SlotView[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, formAction] = useActionState(createBookingAction, idleState);
  const [chosenSlot, setChosenSlot] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const amenity = amenities.find((entry) => entry.slug === selectedSlug) ?? amenities[0];

  useActionFeedback(state, {
    onSuccess: () => {
      setChosenSlot(null);
      router.refresh();
    },
  });

  // Any amenity/date change resets the chosen slot.
  React.useEffect(() => setChosenSlot(null), [selectedSlug, date]);

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) params.set(key, value);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + amenity.maxAdvanceDays);
  const maxDateValue = maxDate.toISOString().slice(0, 10);
  const todayValue = new Date().toISOString().slice(0, 10);

  const bookable = slots.filter((slot) => slot.available && !slot.isPast);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ── Amenity picker ── */}
      <div className="space-y-3 lg:col-span-1">
        {amenities.map((option) => {
          const selected = option.slug === selectedSlug;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => navigate({ amenity: option.slug, date })}
              aria-pressed={selected}
              disabled={isPending}
              className={cn(
                'w-full rounded-xl border p-4 text-left transition-colors',
                selected ? 'border-primary bg-primary-soft' : 'border-border bg-card hover:bg-accent/50',
                !option.isActive && 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={cn('font-semibold', selected && 'text-primary')}>{option.name}</p>
                {!option.isActive ? (
                  <Badge variant="muted">Closed</Badge>
                ) : option.requiresApproval ? (
                  <Badge variant="warning">Approval</Badge>
                ) : null}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" aria-hidden />
                  {option.hours}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" aria-hidden />
                  {option.capacity}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IndianRupee className="size-3" aria-hidden />
                  {option.feeLabel}
                </span>
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Slots + form ── */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{amenity.name}</CardTitle>
          <CardDescription>{amenity.description ?? 'Check availability and reserve a slot.'}</CardDescription>
          {amenity.location ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {amenity.location}
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-5">
          {!amenity.isActive ? (
            <Alert variant="warning" title="Bookings are closed">
              {amenity.name} is not accepting bookings at the moment. Contact the society office for details.
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="bookingDate">
              <CalendarDays className="size-4" aria-hidden />
              Choose a date
            </Label>
            <Input
              id="bookingDate"
              type="date"
              value={date}
              min={todayValue}
              max={maxDateValue}
              onChange={(event) => navigate({ amenity: selectedSlug, date: event.target.value })}
              className="sm:max-w-56"
            />
            <p className="text-xs text-muted-foreground">
              Bookable up to {amenity.maxAdvanceDays} days ahead.
            </p>
          </div>

          {/* Slot grid */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Availability
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {bookable.length} of {slots.length} slots free
              </span>
            </p>

            {slots.length === 0 ? (
              <Alert variant="info">No bookable slots are configured for this amenity.</Alert>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {slots.map((slot) => {
                  const disabled = !slot.available || slot.isPast || !amenity.isActive;
                  const selected = chosenSlot === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      disabled={disabled}
                      onClick={() => setChosenSlot(slot.startsAt)}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-center text-sm transition-colors',
                        selected && 'border-primary bg-primary text-primary-foreground',
                        !selected && !disabled && 'border-border hover:border-primary hover:bg-primary-soft',
                        disabled && 'cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground',
                      )}
                    >
                      <span className="block font-medium">{slot.label}</span>
                      <span className="block text-[10px] opacity-80">
                        {slot.isPast
                          ? 'Past'
                          : slot.mine
                            ? 'Yours'
                            : slot.available
                              ? `to ${slot.endLabel}`
                              : `Flat ${slot.bookedBy}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-border bg-card" aria-hidden />
                Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-muted" aria-hidden />
                Taken or past
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary" aria-hidden />
                Selected
              </span>
            </div>
          </div>

          {/* Booking form */}
          <form action={formAction} className="space-y-4 border-t border-border pt-5">
            <input type="hidden" name="amenityId" value={amenity.id} />
            <input type="hidden" name="startsAt" value={chosenSlot ?? ''} />

            {state.status === 'error' ? (
              <Alert variant="destructive" title="Could not complete the booking">
                {state.message}
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="slots">Duration</Label>
                <Select name="slots" defaultValue="1">
                  <SelectTrigger id="slots">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: amenity.maxSlotsPerBooking }, (_, index) => index + 1).map(
                      (count) => (
                        <SelectItem key={count} value={String(count)}>
                          {(count * amenity.slotMinutes) / 60 >= 1
                            ? `${(count * amenity.slotMinutes) / 60} hour${count * amenity.slotMinutes > 60 ? 's' : ''}`
                            : `${count * amenity.slotMinutes} minutes`}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="guestsCount">Number of people</Label>
                <Input
                  id="guestsCount"
                  name="guestsCount"
                  type="number"
                  min={1}
                  max={amenity.capacity}
                  defaultValue={2}
                />
                {fieldErrors(state, 'guestsCount') ? (
                  <p className="text-xs font-medium text-destructive">
                    {fieldErrors(state, 'guestsCount')?.[0]}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Capacity {amenity.capacity}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Fee</Label>
                <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm font-medium">
                  {amenity.fee > 0 ? formatCurrency(amenity.fee) : 'Free'}
                </div>
                <p className="text-xs text-muted-foreground">Per slot</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purpose">Purpose (optional)</Label>
              <Textarea
                id="purpose"
                name="purpose"
                rows={2}
                maxLength={200}
                placeholder="Birthday celebration for 20 guests"
              />
            </div>

            {amenity.requiresApproval ? (
              <Alert variant="info">
                {amenity.name} bookings need committee approval. You will be notified once a decision is
                made — the slot is held for you in the meantime.
              </Alert>
            ) : null}

            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {chosenSlot ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <CheckCircle2 className="size-4 text-primary" aria-hidden />
                    {slots.find((slot) => slot.startsAt === chosenSlot)?.label} on {date}
                  </span>
                ) : (
                  'Pick a time slot above to continue.'
                )}
              </p>
              <SubmitButton size="lg" disabled={!chosenSlot || !amenity.isActive}>
                {amenity.requiresApproval ? 'Request booking' : 'Confirm booking'}
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
