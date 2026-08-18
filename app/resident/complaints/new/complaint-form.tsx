'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, X } from 'lucide-react';

import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { createComplaintAction } from '@/actions/complaint-actions';
import { idleState } from '@/lib/action-result';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'ELEVATOR', label: 'Elevator' },
  { value: 'WATER', label: 'Water supply' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'CARPENTRY', label: 'Carpentry' },
  { value: 'PEST_CONTROL', label: 'Pest control' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low', hint: 'Can wait a few days' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Needs attention this week' },
  { value: 'HIGH', label: 'High', hint: 'Affecting daily use' },
  { value: 'CRITICAL', label: 'Critical', hint: 'Safety risk right now' },
];

const MAX_PHOTOS = 4;
const MAX_BYTES = 5 * 1024 * 1024;

export function ComplaintForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(createComplaintAction, idleState);
  const [priority, setPriority] = React.useState('MEDIUM');
  const [previews, setPreviews] = React.useState<{ name: string; url: string; size: number }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useActionFeedback(state, {
    onSuccess: (data) => {
      if (data?.complaintId) router.push(`/resident/complaints/${data.complaintId}`);
    },
  });

  // Revoke object URLs so previewing photos does not leak memory.
  React.useEffect(() => {
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS);
    setPreviews(
      files.map((file) => ({ name: file.name, url: URL.createObjectURL(file), size: file.size })),
    );
  }

  function clearFiles() {
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const oversized = previews.filter((preview) => preview.size > MAX_BYTES);

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && !state.fieldErrors ? (
        <Alert variant="destructive" title="Could not raise the ticket">
          {state.message}
        </Alert>
      ) : null}

      <Field
        label="What is the problem?"
        htmlFor="title"
        required
        hint="A short headline, e.g. “Kitchen sink drain is blocked”"
        errors={fieldErrors(state, 'title')}
      >
        <Input id="title" name="title" required minLength={5} maxLength={120} />
      </Field>

      <FormGrid>
        <Field label="Category" htmlFor="category" required errors={fieldErrors(state, 'category')}>
          <Select name="category" defaultValue="PLUMBING">
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Where exactly?"
          htmlFor="location"
          hint="Optional — e.g. “Guest bathroom”, “4th floor lobby”"
          errors={fieldErrors(state, 'location')}
        >
          <Input id="location" name="location" maxLength={120} />
        </Field>
      </FormGrid>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          How urgent is it? <span className="text-destructive">*</span>
        </legend>
        <input type="hidden" name="priority" value={priority} />
        <div className="grid gap-2 sm:grid-cols-4">
          {PRIORITIES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPriority(option.value)}
              aria-pressed={priority === option.value}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                priority === option.value
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border hover:bg-accent/60',
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="Describe the problem"
        htmlFor="description"
        required
        hint="When did it start? What have you already tried? Any access instructions?"
        errors={fieldErrors(state, 'description')}
      >
        <Textarea id="description" name="description" required minLength={15} maxLength={2000} rows={6} />
      </Field>

      {/* ── Photo uploads ── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Photos (optional)</p>
        <p className="text-xs text-muted-foreground">
          Up to {MAX_PHOTOS} images, 5 MB each. JPEG, PNG, WebP or HEIC.
        </p>

        <label
          htmlFor="photos"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors hover:bg-muted/40"
        >
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">Tap to add photos</span>
          <span className="text-xs text-muted-foreground">A photo usually resolves a ticket faster</span>
        </label>
        <input
          ref={fileInputRef}
          id="photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          className="sr-only"
          onChange={handleFiles}
        />

        {previews.length > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {previews.map((preview) => (
                <div
                  key={preview.url}
                  className="relative aspect-square overflow-hidden rounded-lg border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={preview.name} className="size-full object-cover" />
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearFiles}>
              <X className="size-4" />
              Remove photos
            </Button>
          </div>
        ) : null}

        {oversized.length > 0 ? (
          <Alert variant="warning">
            {oversized.length} photo(s) exceed the 5 MB limit and will be rejected. Please choose smaller
            images.
          </Alert>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <SubmitButton size="lg">Raise the ticket</SubmitButton>
      </div>
    </form>
  );
}
