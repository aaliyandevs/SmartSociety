'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { assignComplaintAction } from '@/actions/complaint-actions';
import { idleState } from '@/lib/action-result';
import { cn, humanise } from '@/lib/utils';

export interface StaffChoice {
  id: string;
  name: string;
  department: string;
  designation: string;
  openTickets: number;
  recommended: boolean;
}

export function AssignPanel({
  complaintId,
  currentStaffId,
  currentPriority,
  staff,
  disabled,
}: {
  complaintId: string;
  currentStaffId: string | null;
  currentPriority: string;
  staff: StaffChoice[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(assignComplaintAction, idleState);
  const [selected, setSelected] = React.useState<string | null>(currentStaffId);

  useActionFeedback(state, { onSuccess: () => router.refresh() });

  if (disabled) {
    return <Alert variant="info">This ticket is closed and can no longer be reassigned.</Alert>;
  }

  if (staff.length === 0) {
    return (
      <Alert variant="warning" title="No maintenance staff available">
        Add a technician on the Staff page before routing tickets.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="complaintId" value={complaintId} />
      <input type="hidden" name="staffId" value={selected ?? ''} />

      {state.status === 'error' ? (
        <Alert variant="destructive" title="Could not assign the ticket">
          {state.message}
        </Alert>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Choose a technician</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {staff.map((member) => {
            const active = selected === member.id;
            const isCurrent = currentStaffId === member.id;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelected(member.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  active ? 'border-primary bg-primary-soft' : 'border-border hover:bg-accent/60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.designation} · {humanise(member.department)}
                    </span>
                  </span>
                  {member.recommended ? (
                    <Badge variant="soft" className="shrink-0">
                      <Sparkles className="size-3" />
                      Match
                    </Badge>
                  ) : null}
                </div>
                <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {member.openTickets} open ticket{member.openTickets === 1 ? '' : 's'}
                  </span>
                  {isCurrent ? <Badge variant="muted">Currently assigned</Badge> : null}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field
        label="Change priority"
        htmlFor="priority"
        hint="Leave as-is to keep the current SLA target"
        errors={fieldErrors(state, 'priority')}
      >
        <Select name="priority" defaultValue={currentPriority}>
          <SelectTrigger id="priority" className="sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((priority) => (
              <SelectItem key={priority} value={priority}>
                {humanise(priority)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Note for the technician"
        htmlFor="note"
        hint="Optional — a default assignment note is recorded if left blank"
        errors={fieldErrors(state, 'note')}
      >
        <Textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          placeholder="Resident is home after 4 PM. Carry a spare cartridge."
        />
      </Field>

      <div className="flex justify-end border-t border-border pt-4">
        <SubmitButton disabled={!selected}>
          {currentStaffId ? 'Reassign ticket' : 'Assign ticket'}
        </SubmitButton>
      </div>
    </form>
  );
}
