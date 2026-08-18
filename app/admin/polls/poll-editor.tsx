'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmAction } from '@/components/shared/confirm-action';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { savePollAction, setPollStatusAction } from '@/actions/community-actions';
import { idleState } from '@/lib/action-result';
import { toDateTimeInputValue } from '@/lib/utils';

export interface PollFormValues {
  id: string;
  title: string;
  description: string | null;
  options: string[];
  startsAt: string;
  endsAt: string;
  isAnonymous: boolean;
  showLiveResults: boolean;
  status: string;
  voteCount: number;
}

export function PollEditor({ poll }: { poll?: PollFormValues }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState(savePollAction, idleState);
  const [options, setOptions] = React.useState<string[]>(poll?.options ?? ['', '']);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  // Once voting has begun the option list is frozen so the tally stays valid.
  const optionsLocked = Boolean(poll && poll.voteCount > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {poll ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            New poll
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{poll ? 'Edit poll' : 'Create a poll'}</DialogTitle>
          <DialogDescription>
            Residents can vote once. The database enforces this, so a duplicate vote is impossible.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {poll ? <input type="hidden" name="pollId" value={poll.id} /> : null}

          {state.status === 'error' && !state.fieldErrors ? (
            <Alert variant="destructive">{state.message}</Alert>
          ) : null}

          <Field label="Question" htmlFor="title" required errors={fieldErrors(state, 'title')}>
            <Input
              id="title"
              name="title"
              required
              maxLength={160}
              defaultValue={poll?.title}
              placeholder="Should the society install rooftop solar panels?"
            />
          </Field>

          <Field
            label="Context"
            htmlFor="description"
            hint="Give residents the background they need to decide"
            errors={fieldErrors(state, 'description')}
          >
            <Textarea
              id="description"
              name="description"
              rows={4}
              maxLength={1000}
              defaultValue={poll?.description ?? ''}
            />
          </Field>

          <div className="space-y-2">
            <Label>
              Options <span className="text-destructive">*</span>
            </Label>

            {optionsLocked ? (
              <Alert variant="info">
                {poll!.voteCount} vote(s) have been cast, so the options are locked. Other details can
                still be edited.
              </Alert>
            ) : null}

            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    name="options"
                    value={option}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((value, i) => (i === index ? event.target.value : value)),
                      )
                    }
                    maxLength={120}
                    placeholder={`Option ${index + 1}`}
                    aria-label={`Option ${index + 1}`}
                    disabled={optionsLocked}
                    required={!optionsLocked}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                    disabled={optionsLocked || options.length <= 2}
                    aria-label={`Remove option ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOptions((current) => [...current, ''])}
              disabled={optionsLocked || options.length >= 10}
            >
              <Plus className="size-4" />
              Add option
            </Button>

            {fieldErrors(state, 'options') ? (
              <p className="text-xs font-medium text-destructive">{fieldErrors(state, 'options')?.[0]}</p>
            ) : null}
          </div>

          <FormGrid>
            <Field label="Opens at" htmlFor="startsAt" required errors={fieldErrors(state, 'startsAt')}>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={poll?.startsAt ?? toDateTimeInputValue(new Date())}
              />
            </Field>
            <Field label="Closes at" htmlFor="endsAt" required errors={fieldErrors(state, 'endsAt')}>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={
                  poll?.endsAt ?? toDateTimeInputValue(new Date(Date.now() + 7 * 86_400_000))
                }
              />
            </Field>
          </FormGrid>

          <Field label="Status" htmlFor="status" required>
            <Select name="status" defaultValue={poll?.status ?? 'ACTIVE'}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft — not visible to residents</SelectItem>
                <SelectItem value="ACTIVE">Active — open for voting</SelectItem>
                <SelectItem value="CLOSED">Closed — results published</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isAnonymous"
                name="isAnonymous"
                value="true"
                defaultChecked={poll?.isAnonymous ?? true}
                disabled={optionsLocked}
              />
              <Label htmlFor="isAnonymous" className="font-normal">
                Anonymous — individual choices are never shown
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showLiveResults"
                name="showLiveResults"
                value="true"
                defaultChecked={poll?.showLiveResults}
              />
              <Label htmlFor="showLiveResults" className="font-normal">
                Show running results to residents before the poll closes
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{poll ? 'Save changes' : 'Create poll'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PollStatusButtons({ pollId, status }: { pollId: string; status: string }) {
  const router = useRouter();

  async function setStatus(next: string) {
    const formData = new FormData();
    formData.set('pollId', pollId);
    formData.set('status', next);

    const result = await setPollStatusAction({ status: 'idle' }, formData);
    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  if (status === 'CLOSED') return null;

  if (status === 'DRAFT') {
    return (
      <ConfirmAction
        variant="default"
        title="Open this poll for voting?"
        description="Residents will be notified and can start casting their votes immediately."
        confirmLabel="Open poll"
        onConfirm={() => setStatus('ACTIVE')}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Open poll for voting">
            <PlayCircle className="size-4 text-success" />
          </Button>
        }
      />
    );
  }

  return (
    <ConfirmAction
      title="Close this poll?"
      description="Voting stops immediately and the results become visible to all residents."
      confirmLabel="Close poll"
      onConfirm={() => setStatus('CLOSED')}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Close poll">
          <Lock className="size-4 text-destructive" />
        </Button>
      }
    />
  );
}
