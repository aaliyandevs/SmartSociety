'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Field, SubmitButton, useActionFeedback } from '@/components/shared/form';
import { reviewBookingAction } from '@/actions/amenity-actions';
import { idleState } from '@/lib/action-result';

export function BookingReview({
  bookingId,
  amenityName,
}: {
  bookingId: string;
  amenityName: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(reviewBookingAction, idleState);
  const [rejectOpen, setRejectOpen] = React.useState(false);

  useActionFeedback(state, {
    onSuccess: () => {
      setRejectOpen(false);
      router.refresh();
    },
  });

  return (
    <div className="flex shrink-0 gap-2">
      <form action={formAction}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="decision" value="CONFIRMED" />
        <SubmitButton variant="success" size="sm">
          <Check className="size-4" />
          Approve
        </SubmitButton>
      </form>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)}>
          <X className="size-4" />
          Reject
        </Button>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this {amenityName} booking?</DialogTitle>
            <DialogDescription>
              The slot is released and the resident is notified with your reason.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="decision" value="REJECTED" />

            <Field label="Reason" htmlFor="reason" hint="Shared with the resident">
              <Textarea
                id="reason"
                name="reason"
                rows={3}
                maxLength={200}
                placeholder="The hall is reserved for the general body meeting that evening."
              />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive">Reject booking</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
