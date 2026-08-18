'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/shared/confirm-action';
import { recordExitAction } from '@/actions/gate-actions';

/**
 * One-tap exit recording. Wrapped in a confirmation because an accidental tap
 * on a gate tablet would otherwise close out the wrong visitor.
 */
export function ExitButton({
  gateLogId,
  visitorName,
  compact = false,
}: {
  gateLogId: string;
  visitorName: string;
  compact?: boolean;
}) {
  const router = useRouter();

  async function handleConfirm() {
    const formData = new FormData();
    formData.set('gateLogId', gateLogId);
    const result = await recordExitAction({ status: 'idle' }, formData);

    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  return (
    <ConfirmAction
      variant="default"
      title="Record exit?"
      description={`This marks ${visitorName} as having left the society. The exit time is stamped now.`}
      confirmLabel="Record exit"
      onConfirm={handleConfirm}
      trigger={
        compact ? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
            Record exit
          </Button>
        ) : (
          <Button variant="outline" size="lg">
            <LogOut className="size-4" />
            Record exit
          </Button>
        )
      }
    />
  );
}
