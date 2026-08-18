'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import type { ComplaintStatus } from '@prisma/client';
import { Star } from 'lucide-react';

import { Alert } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/textarea';
import { Field, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { addComplaintNoteAction, rateComplaintAction } from '@/actions/complaint-actions';
import { idleState } from '@/lib/action-result';
import { cn } from '@/lib/utils';

export function ResidentTicketActions({
  complaintId,
  status,
  satisfaction,
}: {
  complaintId: string;
  status: ComplaintStatus;
  satisfaction: number | null;
}) {
  const router = useRouter();
  const [noteState, noteAction] = useActionState(addComplaintNoteAction, idleState);
  const [rateState, rateAction] = useActionState(rateComplaintAction, idleState);
  const [rating, setRating] = React.useState(satisfaction ?? 0);
  const [hovered, setHovered] = React.useState(0);

  useActionFeedback(noteState, { onSuccess: () => router.refresh() });
  useActionFeedback(rateState, { onSuccess: () => router.refresh() });

  const canRate = status === 'RESOLVED' || status === 'CLOSED';
  const closed = status === 'CLOSED';

  return (
    <div className="space-y-6">
      {closed && satisfaction ? (
        <Alert variant="success" title="Thanks for your feedback">
          You rated this work {satisfaction} out of 5.
        </Alert>
      ) : null}

      {canRate && !satisfaction ? (
        <form action={rateAction} className="space-y-3 rounded-lg border border-border p-4">
          <input type="hidden" name="complaintId" value={complaintId} />
          <input type="hidden" name="satisfaction" value={rating} />

          <p className="text-sm font-medium">How satisfied are you with the work?</p>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Satisfaction rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHovered(value)}
                onMouseLeave={() => setHovered(0)}
                className="rounded p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    'size-7',
                    value <= (hovered || rating)
                      ? 'fill-warning text-warning'
                      : 'text-muted-foreground/40',
                  )}
                />
              </button>
            ))}
          </div>
          {fieldErrors(rateState, 'satisfaction') ? (
            <p className="text-xs font-medium text-destructive">Pick a rating first.</p>
          ) : null}

          <SubmitButton size="sm" disabled={rating === 0}>
            Submit rating
          </SubmitButton>
        </form>
      ) : null}

      {!closed ? (
        <form action={noteAction} className="space-y-3">
          <input type="hidden" name="complaintId" value={complaintId} />
          <Field
            label="Add a note"
            htmlFor="note"
            hint="Anything the technician should know — access times, whether the problem has changed."
            errors={fieldErrors(noteState, 'note')}
          >
            <Textarea
              id="note"
              name="note"
              rows={3}
              required
              minLength={3}
              maxLength={1000}
              placeholder="The leak is worse this morning. Someone will be home after 4 PM."
            />
          </Field>
          <div className="flex justify-end">
            <SubmitButton variant="outline">Post note</SubmitButton>
          </div>
        </form>
      ) : (
        <Alert variant="info">
          This ticket is closed. Raise a new ticket if the problem comes back.
        </Alert>
      )}
    </div>
  );
}
