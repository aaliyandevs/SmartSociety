'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Plus, Trash2 } from 'lucide-react';
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
import { EmptyState } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { ConfirmAction } from '@/components/shared/confirm-action';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import {
  deleteDirectoryContactAction,
  saveDirectoryContactAction,
} from '@/actions/society-actions';
import { idleState } from '@/lib/action-result';

export interface DirectoryContact {
  id: string;
  name: string;
  designation: string | null;
  phone: string;
  altPhone: string | null;
  sortOrder: number;
}

export function DirectoryManager({ contacts }: { contacts: DirectoryContact[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DirectoryContact | null>(null);
  const [state, formAction] = useActionState(saveDirectoryContactAction, idleState);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      router.refresh();
    },
  });

  async function remove(id: string) {
    const result = await deleteDirectoryContactAction(id);
    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" />
              Add contact
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit directory entry' : 'Add a directory entry'}</DialogTitle>
              <DialogDescription>
                Shown to residents, guards and staff on their emergency pages.
              </DialogDescription>
            </DialogHeader>

            <form action={formAction} className="space-y-4">
              {editing ? <input type="hidden" name="contactId" value={editing.id} /> : null}

              <FormGrid>
                <Field label="Name" htmlFor="name" required errors={fieldErrors(state, 'name')}>
                  <Input
                    id="name"
                    name="name"
                    required
                    maxLength={80}
                    placeholder="Fire Brigade"
                    defaultValue={editing?.name}
                  />
                </Field>
                <Field
                  label="Designation"
                  htmlFor="designation"
                  errors={fieldErrors(state, 'designation')}
                >
                  <Input
                    id="designation"
                    name="designation"
                    maxLength={60}
                    placeholder="Pune Fire Control Room"
                    defaultValue={editing?.designation ?? ''}
                  />
                </Field>
              </FormGrid>

              <FormGrid>
                <Field label="Phone" htmlFor="phone" required errors={fieldErrors(state, 'phone')}>
                  <Input
                    id="phone"
                    name="phone"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    defaultValue={editing?.phone}
                  />
                </Field>
                <Field
                  label="Alternate phone"
                  htmlFor="altPhone"
                  errors={fieldErrors(state, 'altPhone')}
                >
                  <Input
                    id="altPhone"
                    name="altPhone"
                    inputMode="numeric"
                    maxLength={10}
                    defaultValue={editing?.altPhone ?? ''}
                  />
                </Field>
              </FormGrid>

              <Field
                label="Display order"
                htmlFor="sortOrder"
                hint="Lower numbers appear first"
                errors={fieldErrors(state, 'sortOrder')}
              >
                <Input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  min={0}
                  max={999}
                  defaultValue={editing?.sortOrder ?? contacts.length + 1}
                />
              </Field>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton>{editing ? 'Save changes' : 'Add contact'}</SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="Directory is empty"
          description="Add the society office, security desk and civic emergency numbers."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="tabular w-8 shrink-0 text-xs text-muted-foreground">
                {contact.sortOrder}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{contact.name}</p>
                <p className="text-xs text-muted-foreground">
                  {contact.designation ?? '—'} · {contact.phone}
                  {contact.altPhone ? ` / ${contact.altPhone}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(contact);
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                <ConfirmAction
                  title={`Remove ${contact.name}?`}
                  description="The number disappears from every emergency directory page."
                  confirmLabel="Remove"
                  onConfirm={() => remove(contact.id)}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${contact.name}`}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
