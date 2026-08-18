'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/shared/confirm-action';
import { cancelBookingAction } from '@/actions/amenity-actions';

export function CancelBookingButton({
  bookingId,
  amenityName,
  minCancelHours,
}: {
  bookingId: string;
  amenityName: string;
  minCancelHours: number;
}) {
  const router = useRouter();

  async function handleConfirm() {
    const formData = new FormData();
    formData.set('bookingId', bookingId);
    formData.set('reason', 'Cancelled by the resident');

    const result = await cancelBookingAction({ status: 'idle' }, formData);
    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  return (
    <ConfirmAction
      title={`Cancel your ${amenityName} booking?`}
      description={`The slot is released for other residents immediately. Cancellations are only allowed up to ${minCancelHours} hours before the booking starts.`}
      confirmLabel="Cancel booking"
      cancelLabel="Keep it"
      onConfirm={handleConfirm}
      trigger={
        <Button variant="outline" size="sm">
          Cancel
        </Button>
      }
    />
  );
}
