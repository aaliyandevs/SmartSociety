import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { CarFront } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { humanise } from '@/lib/utils';

export const metadata: Metadata = { title: 'Vehicle Register' };

const PAGE_SIZE = 25;

export default async function GuardVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  await requireRole('GUARD', 'ADMIN');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.VehicleWhereInput = {
    deletedAt: null,
    ...(params.type ? { vehicleType: params.type as Prisma.EnumVehicleTypeFilter['equals'] } : {}),
    ...(params.q
      ? {
          OR: [
            { registrationNo: { contains: params.q.replace(/[\s-]/g, ''), mode: 'insensitive' } },
            { flat: { flatNumber: { contains: params.q, mode: 'insensitive' } } },
            { resident: { user: { fullName: { contains: params.q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { registrationNo: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        flat: { include: { block: true } },
        resident: { include: { user: { select: { fullName: true, phone: true } } } },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reference"
        title="Vehicle register"
        description="Look up a registration number to confirm which flat a vehicle belongs to."
      />

      <Alert variant="info">
        Resident phone numbers are shown so you can reach an owner about a blocked or wrongly-parked
        vehicle. Do not share them with visitors.
      </Alert>

      <FilterBar
        searchPlaceholder="Search registration, flat or owner…"
        filters={[
          {
            name: 'type',
            label: 'Vehicle type',
            options: [
              { value: 'CAR', label: 'Car' },
              { value: 'BIKE', label: 'Bike' },
              { value: 'SCOOTER', label: 'Scooter' },
              { value: 'BICYCLE', label: 'Bicycle' },
              { value: 'OTHER', label: 'Other' },
            ],
          },
        ]}
      />

      {vehicles.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title="No vehicles found"
          description="Try a different registration number, flat or owner name."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registration</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Flat</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Parking slot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {vehicle.registrationNo}
                      </Badge>
                    </TableCell>
                    <TableCell>{humanise(vehicle.vehicleType)}</TableCell>
                    <TableCell className="text-sm">
                      {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}
                      {vehicle.color ? (
                        <span className="text-muted-foreground"> · {vehicle.color}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {vehicle.flat.block.name}-{vehicle.flat.flatNumber}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p>{vehicle.resident.user.fullName}</p>
                      <a
                        href={`tel:${vehicle.resident.user.phone}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {vehicle.resident.user.phone}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm">{vehicle.parkingSlot ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {vehicles.map((vehicle) => (
              <Card key={vehicle.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className="font-mono text-sm">
                      {vehicle.registrationNo}
                    </Badge>
                    <Badge variant="muted">{humanise(vehicle.vehicleType)}</Badge>
                  </div>
                  <p className="mt-2 text-sm">
                    Flat{' '}
                    <span className="font-medium">
                      {vehicle.flat.block.name}-{vehicle.flat.flatNumber}
                    </span>{' '}
                    · {vehicle.resident.user.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' · ') || '—'}
                    {vehicle.parkingSlot ? ` · slot ${vehicle.parkingSlot}` : ''}
                  </p>
                  <a
                    href={`tel:${vehicle.resident.user.phone}`}
                    className="mt-2 inline-block text-sm text-primary hover:underline"
                  >
                    Call {vehicle.resident.user.phone}
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>

          <DataPagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  );
}
