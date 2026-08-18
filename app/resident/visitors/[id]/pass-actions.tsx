'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/shared/confirm-action';
import { cancelGatePassAction } from '@/actions/gate-actions';

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Gate code copied.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Please note the code down manually.');
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={copy} className="mt-2">
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? 'Copied' : 'Copy code'}
    </Button>
  );
}

export function CancelPassButton({ passId, visitorName }: { passId: string; visitorName: string }) {
  const router = useRouter();

  async function handleConfirm() {
    const formData = new FormData();
    formData.set('passId', passId);
    formData.set('reason', 'Cancelled by the resident');

    const result = await cancelGatePassAction({ status: 'idle' }, formData);
    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  return (
    <ConfirmAction
      title="Cancel this pass?"
      description={`${visitorName} will no longer be able to enter using this pass. You can always create a new one.`}
      confirmLabel="Cancel pass"
      cancelLabel="Keep it"
      onConfirm={handleConfirm}
      trigger={
        <Button variant="outline">
          <Ban className="size-4" />
          Cancel pass
        </Button>
      }
    />
  );
}
