'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Power } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';
import { Checkbox } from '@/components/ui/misc';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmAction } from '@/components/shared/confirm-action';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { saveAmenityAction, toggleAmenityAction } from '@/actions/amenity-actions';
import { idleState } from '@/lib/action-result';

export interface AmenityFormValues {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number;
  openMinute: number;
  closeMinute: number;
  slotMinutes: number;
  bookingFee: number;
  maxAdvanceDays: number;
  minCancelHours: number;
  maxSlotsPerBooking: number;
  requiresApproval: boolean;
  isActive: boolean;
}

/** Minutes-from-midnight ⇄ the value an <input type="time"> expects. */
const toTimeValue = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function AmenityEditor({ amenity }: { amenity?: AmenityFormValues }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState(saveAmenityAction, idleState);
  const [openTime, setOpenTime] = React.useState(toTimeValue(amenity?.openMinute ?? 360));
  const [closeTime, setCloseTime] = React.useState(toTimeValue(amenity?.closeMinute ?? 1320));

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {amenity ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Add amenity
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{amenity ? `Edit ${amenity.name}` : 'Add an amenity'}</DialogTitle>
          <DialogDescription>
            Opening hours must divide evenly into slots of the chosen length.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {amenity ? <input type="hidden" name="amenityId" value={amenity.id} /> : null}
          <input type="hidden" name="openMinute" value={toMinutes(openTime)} />
          <input type="hidden" name="closeMinute" value={toMinutes(closeTime)} />

          {state.status === 'error' && !state.fieldErrors ? (
            <Alert variant="destructive">{state.message}</Alert>
          ) : null}

          <FormGrid>
            <Field label="Name" htmlFor="name" required errors={fieldErrors(state, 'name')}>
              <Input id="name" name="name" required maxLength={60} defaultValue={amenity?.name} />
            </Field>
            <Field label="Location" htmlFor="location" errors={fieldErrors(state, 'location')}>
              <Input
                id="location"
                name="location"
                maxLength={80}
                placeholder="Tower D, Ground Floor"
                defaultValue={amenity?.location ?? ''}
              />
            </Field>
          </FormGrid>

          <Field label="Description" htmlFor="description" errors={fieldErrors(state, 'description')}>
            <Textarea
              id="description"
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={amenity?.description ?? ''}
            />
          </Field>

          <FormGrid className="sm:grid-cols-3">
            <Field label="Opens at" htmlFor="openTime" required errors={fieldErrors(state, 'openMinute')}>
              <Input
                id="openTime"
                type="time"
                value={openTime}
                onChange={(event) => setOpenTime(event.target.value)}
                required
              />
            </Field>
            <Field
              label="Closes at"
              htmlFor="closeTime"
              required
              errors={fieldErrors(state, 'closeMinute')}
            >
              <Input
                id="closeTime"
                type="time"
                value={closeTime}
                onChange={(event) => setCloseTime(event.target.value)}
                required
              />
            </Field>
            <Field
              label="Slot length (min)"
              htmlFor="slotMinutes"
              required
              errors={fieldErrors(state, 'slotMinutes')}
            >
              <Input
                id="slotMinutes"
                name="slotMinutes"
                type="number"
                min={15}
                max={480}
                step={15}
                required
                defaultValue={amenity?.slotMinutes ?? 60}
              />
            </Field>
          </FormGrid>

          <FormGrid className="sm:grid-cols-3">
            <Field label="Capacity" htmlFor="capacity" required errors={fieldErrors(state, 'capacity')}>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                max={1000}
                required
                defaultValue={amenity?.capacity ?? 20}
              />
            </Field>
            <Field
              label="Booking fee"
              htmlFor="bookingFee"
              required
              errors={fieldErrors(state, 'bookingFee')}
            >
              <Input
                id="bookingFee"
                name="bookingFee"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={amenity?.bookingFee ?? 0}
              />
            </Field>
            <Field
              label="Max slots per booking"
              htmlFor="maxSlotsPerBooking"
              required
              errors={fieldErrors(state, 'maxSlotsPerBooking')}
            >
              <Input
                id="maxSlotsPerBooking"
                name="maxSlotsPerBooking"
                type="number"
                min={1}
                max={12}
                required
                defaultValue={amenity?.maxSlotsPerBooking ?? 2}
              />
            </Field>
          </FormGrid>

          <FormGrid>
            <Field
              label="Book up to (days ahead)"
              htmlFor="maxAdvanceDays"
              required
              errors={fieldErrors(state, 'maxAdvanceDays')}
            >
              <Input
                id="maxAdvanceDays"
                name="maxAdvanceDays"
                type="number"
                min={1}
                max={180}
                required
                defaultValue={amenity?.maxAdvanceDays ?? 30}
              />
            </Field>
            <Field
              label="Free cancellation window (hours)"
              htmlFor="minCancelHours"
              required
              errors={fieldErrors(state, 'minCancelHours')}
            >
              <Input
                id="minCancelHours"
                name="minCancelHours"
                type="number"
                min={0}
                max={168}
                required
                defaultValue={amenity?.minCancelHours ?? 4}
              />
            </Field>
          </FormGrid>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="requiresApproval"
                name="requiresApproval"
                value="true"
                defaultChecked={amenity?.requiresApproval}
              />
              <Label htmlFor="requiresApproval" className="font-normal">
                Bookings need committee approval
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                name="isActive"
                value="true"
                defaultChecked={amenity?.isActive ?? true}
              />
              <Label htmlFor="isActive" className="font-normal">
                Open for bookings
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{amenity ? 'Save changes' : 'Add amenity'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AmenityToggle({
  amenityId,
  isActive,
  name,
}: {
  amenityId: string;
  isActive: boolean;
  name: string;
}) {
  const router = useRouter();

  async function toggle() {
    const result = await toggleAmenityAction(amenityId);
    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  return (
    <ConfirmAction
      variant={isActive ? 'destructive' : 'default'}
      title={isActive ? `Close ${name} for bookings?` : `Reopen ${name}?`}
      description={
        isActive
          ? 'Residents will no longer be able to book this amenity. Existing bookings are unaffected.'
          : 'Residents will be able to book this amenity again.'
      }
      confirmLabel={isActive ? 'Close bookings' : 'Reopen'}
      onConfirm={toggle}
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={isActive ? `Close ${name}` : `Reopen ${name}`}
        >
          <Power className={isActive ? 'size-4 text-destructive' : 'size-4 text-success'} />
        </Button>
      }
    />
  );
}
