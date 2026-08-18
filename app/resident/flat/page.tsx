import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, CarFront, Home, Ruler, Users } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { FamilyMembers } from '@/app/resident/flat/family-members';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatCurrency, formatDate, humanise } from '@/lib/utils';

export const metadata: Metadata = { title: 'My Flat' };

export default async function ResidentFlatPage() {
  const user = await requireResident();

  const [profile, flat] = await Promise.all([
    prisma.residentProfile.findUniqueOrThrow({
      where: { id: user.residentId },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        familyMembers: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.flat.findUniqueOrThrow({
      where: { id: user.flatId },
      include: {
        block: true,
        residents: {
          where: { deletedAt: null },
          include: { user: { select: { fullName: true, phone: true } } },
          orderBy: { isPrimary: 'desc' },
        },
        vehicles: { where: { deletedAt: null } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My home"
        title={`Flat ${flat.block.name}-${flat.flatNumber}`}
        description={flat.block.label ?? `Block ${flat.block.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={flat.occupancyStatus} />
            <StatusBadge status={profile.residentType} />
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Unit type', value: humanise(flat.flatType), icon: Home },
          { label: 'Floor', value: `Floor ${flat.floor}`, icon: Building2 },
          {
            label: 'Carpet area',
            value: flat.carpetAreaSqft ? `${flat.carpetAreaSqft} sq ft` : '—',
            icon: Ruler,
          },
          {
            label: 'Monthly maintenance',
            value: formatCurrency(flat.baseMaintenance),
            icon: Home,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="block truncate font-semibold">{item.value}</span>
                </span>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Family & household members</CardTitle>
            <CardDescription>
              Keep this list current so the security desk can verify who lives here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FamilyMembers
              members={profile.familyMembers.map((member) => ({
                id: member.id,
                fullName: member.fullName,
                relation: member.relation,
                age: member.age,
                phone: member.phone,
                isDependent: member.isDependent,
              }))}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-muted-foreground" aria-hidden />
                Registered residents
              </CardTitle>
              <CardDescription>People on record for this flat.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border border-t border-border">
                {flat.residents.map((resident) => (
                  <li key={resident.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{resident.user.fullName}</p>
                      {resident.isPrimary ? <Badge variant="soft">Primary</Badge> : null}
                      <StatusBadge status={resident.residentType} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {resident.user.phone} · since {formatDate(resident.moveInDate)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CarFront className="size-4 text-muted-foreground" aria-hidden />
                  Vehicles
                </CardTitle>
                <CardDescription>
                  {flat.parkingSlots} allotted parking slot{flat.parkingSlots === 1 ? '' : 's'}.
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/resident/vehicles">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {flat.vehicles.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No vehicles registered yet.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {flat.vehicles.map((vehicle) => (
                    <li key={vehicle.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="min-w-0">
                        <Badge variant="outline" className="font-mono">
                          {vehicle.registrationNo}
                        </Badge>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {[vehicle.make, vehicle.model].filter(Boolean).join(' ') ||
                            humanise(vehicle.vehicleType)}
                          {vehicle.parkingSlot ? ` · slot ${vehicle.parkingSlot}` : ''}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">My details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Name</span>
                <span className="text-right font-medium">{profile.user.fullName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Email</span>
                <span className="min-w-0 truncate text-right font-medium">{profile.user.email}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Phone</span>
                <span className="text-right font-medium">{profile.user.phone}</span>
              </div>
              {profile.alternatePhone ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Alternate</span>
                  <span className="text-right font-medium">{profile.alternatePhone}</span>
                </div>
              ) : null}
              {profile.occupation ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Occupation</span>
                  <span className="text-right font-medium">{profile.occupation}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Resident since</span>
                <span className="text-right font-medium">{formatDate(profile.moveInDate)}</span>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <Link href="/account">Edit my profile</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
