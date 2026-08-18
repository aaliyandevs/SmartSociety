'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import type { ComplaintStatus } from '@prisma/client';

import { Alert } from '@/components/ui/feedback';
import { Checkbox } from '@/components/ui/misc';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import {
  addComplaintNoteAction,
  updateComplaintStatusAction,
} from '@/actions/complaint-actions';
import { idleState } from '@/lib/action-result';
import { cn, humanise } from '@/lib/utils';

/**
 * Status transitions a technician may perform. Closing a ticket is reserved for
 * an administrator, which mirrors the service-layer rule.
 */
const STAFF_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  PENDING: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED', 'PENDING'],
  RESOLVED: ['IN_PROGRESS'],
  CLOSED: [],
};

export function TicketWorkPanel({
  complaintId,
  currentStatus,
  canClose,
}: {
  complaintId: string;
  currentStatus: ComplaintStatus;
  canClose: boolean;
}) {
  const router = useRouter();
  const [statusState, statusAction] = useActionState(updateComplaintStatusAction, idleState);
  const [noteState, noteAction] = useActionState(addComplaintNoteAction, idleState);
  const [target, setTarget] = React.useState<ComplaintStatus | null>(null);

  useActionFeedback(statusState, {
    onSuccess: () => {
      setTarget(null);
      router.refresh();
    },
  });
  useActionFeedback(noteState, { onSuccess: () => router.refresh() });

  const options = [...STAFF_TRANSITIONS[currentStatus], ...(canClose ? (['CLOSED'] as const) : [])].filter(
    (status, index, all) => all.indexOf(status) === index,
  );

  if (options.length === 0 && currentStatus === 'CLOSED') {
    return <Alert variant="info">This ticket is closed. No further changes can be made.</Alert>;
  }

  return (
    <Tabs defaultValue="status">
      <TabsList>
        <TabsTrigger value="status">Change status</TabsTrigger>
        <TabsTrigger value="note">Add a work note</TabsTrigger>
      </TabsList>

      <TabsContent value="status">
        <form action={statusAction} className="space-y-4">
          <input type="hidden" name="complaintId" value={complaintId} />
          <input type="hidden" name="status" value={target ?? ''} />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Move this ticket to</legend>
            <div className="flex flex-wrap gap-2">
              {options.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setTarget(status)}
                  aria-pressed={target === status}
                  className={cn(
                    'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                    target === status
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border hover:bg-accent/60',
                  )}
                >
                  {humanise(status)}
                </button>
              ))}
            </div>
          </fieldset>

          <Field
            label="Work note"
            htmlFor="note"
            required
            hint="Describe what you did or what is still needed. The resident sees this unless you mark it internal."
            errors={fieldErrors(statusState, 'note')}
          >
            <Textarea
              id="note"
              name="note"
              required
              minLength={3}
              rows={4}
              placeholder="Replaced the tap cartridge and tested for leaks. Working normally now."
            />
          </Field>

          {target === 'RESOLVED' ? (
            <Field
              label="Resolution summary"
              htmlFor="resolutionNotes"
              hint="Shown on the ticket as the official outcome"
              errors={fieldErrors(statusState, 'resolutionNotes')}
            >
              <Textarea
                id="resolutionNotes"
                name="resolutionNotes"
                rows={3}
                placeholder="Leak fixed by replacing the cartridge; verified with the resident."
              />
            </Field>
          ) : null}

          <div className="flex items-center gap-2">
            <Checkbox id="isInternal" name="isInternal" value="true" />
            <Label htmlFor="isInternal" className="font-normal">
              Internal note — hide this from the resident
            </Label>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <SubmitButton disabled={!target}>Save update</SubmitButton>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="note">
        <form action={noteAction} className="space-y-4">
          <input type="hidden" name="complaintId" value={complaintId} />

          <Field
            label="Note"
            htmlFor="standaloneNote"
            required
            errors={fieldErrors(noteState, 'note')}
          >
            <Textarea
              id="standaloneNote"
              name="note"
              required
              minLength={3}
              rows={4}
              placeholder="Visited the flat; the resident was not at home. Will return tomorrow morning."
            />
          </Field>

          <div className="flex items-center gap-2">
            <Checkbox id="noteInternal" name="isInternal" value="true" />
            <Label htmlFor="noteInternal" className="font-normal">
              Internal note — hide this from the resident
            </Label>
          </div>

          <div className="flex justify-end border-t border-border pt-4">
            <SubmitButton variant="outline">Add note</SubmitButton>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
}
