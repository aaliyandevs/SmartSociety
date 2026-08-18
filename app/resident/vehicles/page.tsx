import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { VehicleManager } from '@/app/resident/vehicles/vehicle-manager';
import { Alert } from '@/components/ui/feedback';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const metadata: Metadata = { title: 'My Vehicles' };

export default async function ResidentVehiclesPage() {
  const user = await requireResident();

  const [vehicles, flat] = await Promise.all([
    prisma.vehicle.findMany({
      where: { residentId: user.residentId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.flat.findUniqueOrThrow({
      where: { id: user.flatId },
      select: { parkingSlots: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Flat ${user.flatLabel}`}
        title="My vehicles"
        description="Registered vehicles are visible to the security desk, so your car is never wrongly towed or wheel-locked."
      />

      <Alert variant="info" title={`Your flat has ${flat.parkingSlots} allotted parking slot(s)`}>
        Register every vehicle that regularly parks in the society. Contact the society office if you need
        an additional slot.
      </Alert>

      <VehicleManager
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          registrationNo: vehicle.registrationNo,
          vehicleType: vehicle.vehicleType,
          make: vehicle.make,
          model: vehicle.model,
          color: vehicle.color,
          parkingSlot: vehicle.parkingSlot,
        }))}
      />
    </div>
  );
}
