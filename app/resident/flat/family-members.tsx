'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, UserPlus } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/misc';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmAction } from '@/components/shared/confirm-action';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import {
  deleteFamilyMemberAction,
  saveFamilyMemberAction,
} from '@/actions/profile-actions';
import { idleState } from '@/lib/action-result';

export interface FamilyMemberView {
  id: string;
  fullName: string;
  relation: string;
  age: number | null;
  phone: string | null;
  isDependent: boolean;
}

export function FamilyMembers({ members }: { members: FamilyMemberView[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FamilyMemberView | null>(null);
  const [state, formAction] = useActionState(saveFamilyMemberAction, idleState);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      router.refresh();
    },
  });

  async function remove(id: string) {
    const result = await deleteFamilyMemberAction(id);
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
              Add member
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit household member' : 'Add a household member'}</DialogTitle>
              <DialogDescription>
                These names help the security desk verify who belongs to your flat.
              </DialogDescription>
            </DialogHeader>

            <form action={formAction} className="space-y-4">
              {editing ? <input type="hidden" name="memberId" value={editing.id} /> : null}

              <FormGrid>
                <Field
                  label="Full name"
                  htmlFor="fullName"
                  required
                  errors={fieldErrors(state, 'fullName')}
                >
                  <Input
                    id="fullName"
                    name="fullName"
                    required
                    maxLength={80}
                    defaultValue={editing?.fullName}
                  />
                </Field>
                <Field
                  label="Relationship"
                  htmlFor="relation"
                  required
                  errors={fieldErrors(state, 'relation')}
                >
                  <Input
                    id="relation"
                    name="relation"
                    required
                    maxLength={40}
                    placeholder="Spouse, Son, Mother…"
                    defaultValue={editing?.relation}
                  />
                </Field>
              </FormGrid>

              <FormGrid>
                <Field label="Age" htmlFor="age" errors={fieldErrors(state, 'age')}>
                  <Input
                    id="age"
                    name="age"
                    type="number"
                    min={0}
                    max={120}
                    defaultValue={editing?.age ?? undefined}
                  />
                </Field>
                <Field
                  label="Phone"
                  htmlFor="phone"
                  hint="Optional"
                  errors={fieldErrors(state, 'phone')}
                >
                  <Input
                    id="phone"
                    name="phone"
                    inputMode="numeric"
                    maxLength={11}
                    defaultValue={editing?.phone ?? ''}
                  />
                </Field>
              </FormGrid>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isDependent"
                  name="isDependent"
                  value="true"
                  defaultChecked={editing?.isDependent}
                />
                <Label htmlFor="isDependent" className="font-normal">
                  Dependent (child or senior citizen)
                </Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton>{editing ? 'Save changes' : 'Add member'}</SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No household members added"
          description="Add the people who live in your flat so the gate can verify them."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{member.fullName}</p>
                  <Badge variant="outline">{member.relation}</Badge>
                  {member.isDependent ? <Badge variant="muted">Dependent</Badge> : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[member.age ? `${member.age} years` : null, member.phone]
                    .filter(Boolean)
                    .join(' · ') || 'No further details'}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(member);
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
                <ConfirmAction
                  title={`Remove ${member.fullName}?`}
                  description="They will no longer be listed as a member of your household."
                  confirmLabel="Remove"
                  onConfirm={() => remove(member.id)}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.fullName}`}>
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
