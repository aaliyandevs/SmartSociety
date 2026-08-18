'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import { deleteNoticeAction, saveNoticeAction } from '@/actions/community-actions';
import { idleState } from '@/lib/action-result';
import { humanise, toDateTimeInputValue } from '@/lib/utils';

export interface NoticeFormValues {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  audience: string;
  publishAt: string;
  expiresAt: string;
  eventDate: string;
  eventLocation: string | null;
  isPinned: boolean;
  isPublished: boolean;
}

const CATEGORIES = [
  'GENERAL',
  'MAINTENANCE',
  'EVENT',
  'FINANCIAL',
  'SECURITY',
  'GUIDELINE',
  'EMERGENCY',
];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const AUDIENCES = ['ALL', 'RESIDENTS', 'OWNERS', 'TENANTS', 'STAFF'];

export function NoticeEditor({ notice }: { notice?: NoticeFormValues }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState(saveNoticeAction, idleState);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {notice ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            New notice
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{notice ? 'Edit notice' : 'Publish a notice'}</DialogTitle>
          <DialogDescription>
            Residents are notified when a notice goes live. Markdown headings, lists and **bold** are
            supported in the body.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {notice ? <input type="hidden" name="noticeId" value={notice.id} /> : null}

          {state.status === 'error' && !state.fieldErrors ? (
            <Alert variant="destructive">{state.message}</Alert>
          ) : null}

          <Field label="Title" htmlFor="title" required errors={fieldErrors(state, 'title')}>
            <Input id="title" name="title" required maxLength={140} defaultValue={notice?.title} />
          </Field>

          <Field label="Content" htmlFor="content" required errors={fieldErrors(state, 'content')}>
            <Textarea
              id="content"
              name="content"
              required
              minLength={20}
              rows={8}
              defaultValue={notice?.content}
              placeholder="All members are requested to attend…"
            />
          </Field>

          <FormGrid className="sm:grid-cols-3">
            <Field label="Category" htmlFor="category" required errors={fieldErrors(state, 'category')}>
              <Select name="category" defaultValue={notice?.category ?? 'GENERAL'}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {humanise(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Priority" htmlFor="priority" required errors={fieldErrors(state, 'priority')}>
              <Select name="priority" defaultValue={notice?.priority ?? 'NORMAL'}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {humanise(priority)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Audience" htmlFor="audience" required errors={fieldErrors(state, 'audience')}>
              <Select name="audience" defaultValue={notice?.audience ?? 'ALL'}>
                <SelectTrigger id="audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((audience) => (
                    <SelectItem key={audience} value={audience}>
                      {humanise(audience)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormGrid>

          <FormGrid>
            <Field
              label="Publish at"
              htmlFor="publishAt"
              required
              hint="Set a future time to schedule it"
              errors={fieldErrors(state, 'publishAt')}
            >
              <Input
                id="publishAt"
                name="publishAt"
                type="datetime-local"
                required
                defaultValue={notice?.publishAt ?? toDateTimeInputValue(new Date())}
              />
            </Field>

            <Field
              label="Expires at"
              htmlFor="expiresAt"
              hint="Optional — hides it from the board afterwards"
              errors={fieldErrors(state, 'expiresAt')}
            >
              <Input
                id="expiresAt"
                name="expiresAt"
                type="datetime-local"
                defaultValue={notice?.expiresAt ?? ''}
              />
            </Field>
          </FormGrid>

          <FormGrid>
            <Field
              label="Event date"
              htmlFor="eventDate"
              hint="For event announcements"
              errors={fieldErrors(state, 'eventDate')}
            >
              <Input
                id="eventDate"
                name="eventDate"
                type="datetime-local"
                defaultValue={notice?.eventDate ?? ''}
              />
            </Field>

            <Field
              label="Event location"
              htmlFor="eventLocation"
              errors={fieldErrors(state, 'eventLocation')}
            >
              <Input
                id="eventLocation"
                name="eventLocation"
                maxLength={120}
                placeholder="Clubhouse, Tower D"
                defaultValue={notice?.eventLocation ?? ''}
              />
            </Field>
          </FormGrid>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="isPinned" name="isPinned" value="true" defaultChecked={notice?.isPinned} />
              <Label htmlFor="isPinned" className="font-normal">
                Pin to the top of the board
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPublished"
                name="isPublished"
                value="true"
                defaultChecked={notice?.isPublished ?? true}
              />
              <Label htmlFor="isPublished" className="font-normal">
                Published (uncheck to keep it as a draft)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{notice ? 'Save changes' : 'Publish notice'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteNoticeButton({ noticeId, title }: { noticeId: string; title: string }) {
  const router = useRouter();

  async function remove() {
    const result = await deleteNoticeAction(noticeId);
    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  return (
    <ConfirmAction
      title="Remove this notice?"
      description={`“${title}” disappears from the resident notice board. The record is retained for the audit trail.`}
      confirmLabel="Remove notice"
      onConfirm={remove}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${title}`}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      }
    />
  );
}
