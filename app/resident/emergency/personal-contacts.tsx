'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
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
  deleteEmergencyContactAction,
  saveEmergencyContactAction,
} from '@/actions/profile-actions';
import { idleState } from '@/lib/action-result';

export interface PersonalContact {
  id: string;
  name: string;
  relation: string | null;
  phone: string;
  altPhone: string | null;
  email: string | null;
}

export function PersonalContacts({ contacts }: { contacts: PersonalContact[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PersonalContact | null>(null);
  const [state, formAction] = useActionState(saveEmergencyContactAction, idleState);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      router.refresh();
    },
  });

  async function remove(id: string) {
    const result = await deleteEmergencyContactAction(id);
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
              <DialogTitle>{editing ? 'Edit contact' : 'Add an emergency contact'}</DialogTitle>
              <DialogDescription>
                Visible to the society office and security desk in an emergency.
              </DialogDescription>
            </DialogHeader>

            <form action={formAction} className="space-y-4">
              {editing ? <input type="hidden" name="contactId" value={editing.id} /> : null}

              <FormGrid>
                <Field label="Name" htmlFor="name" required errors={fieldErrors(state, 'name')}>
                  <Input id="name" name="name" required maxLength={80} defaultValue={editing?.name} />
                </Field>
                <Field
                  label="Relationship"
                  htmlFor="relation"
                  errors={fieldErrors(state, 'relation')}
                >
                  <Input
                    id="relation"
                    name="relation"
                    maxLength={40}
                    placeholder="Brother, Neighbour…"
                    defaultValue={editing?.relation ?? ''}
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
                    maxLength={11}
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
                    maxLength={11}
                    defaultValue={editing?.altPhone ?? ''}
                  />
                </Field>
              </FormGrid>

              <Field label="Email" htmlFor="email" errors={fieldErrors(state, 'email')}>
                <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ''} />
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
          title="No personal contacts added"
          description="Add someone the society can reach if you are unavailable during an emergency."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{contact.name}</p>
                  {contact.relation ? <Badge variant="outline">{contact.relation}</Badge> : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <a href={`tel:${contact.phone}`} className="font-mono text-primary hover:underline">
                    {contact.phone}
                  </a>
                  {contact.altPhone ? (
                    <a
                      href={`tel:${contact.altPhone}`}
                      className="font-mono text-muted-foreground hover:underline"
                    >
                      {contact.altPhone}
                    </a>
                  ) : null}
                  {contact.email ? (
                    <span className="text-muted-foreground">{contact.email}</span>
                  ) : null}
                </div>
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
                  description="They will no longer be listed as one of your emergency contacts."
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
