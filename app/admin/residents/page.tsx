import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { Home, UserCheck, Users } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { ResidentManager } from '@/app/admin/residents/resident-manager';
import { Avatar, AvatarFallback } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
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
import { formatDate, initials, toDateInputValue } from '@/lib/utils';
import { residentListInclude } from '@/services/society-service';

export const metadata: Metadata = { title: 'Residents' };

const PAGE_SIZE = 20;

export default async function AdminResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; block?: string; page?: string }>;
}) {
  await requireRole('ADMIN');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.ResidentProfileWhereInput = {
    deletedAt: null,
    ...(params.type ? { residentType: params.type as Prisma.EnumResidentTypeFilter['equals'] } : {}),
    ...(params.status ? { user: { status: params.status as Prisma.EnumUserStatusFilter['equals'] } } : {}),
    ...(params.block ? { flat: { blockId: params.block } } : {}),
    ...(params.q
      ? {
          OR: [
            { user: { fullName: { contains: params.q, mode: 'insensitive' } } },
            { user: { email: { contains: params.q, mode: 'insensitive' } } },
            { user: { phone: { contains: params.q } } },
            { flat: { flatNumber: { contains: params.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [residents, total, counts, blocks, availableFlats] = await Promise.all([
    prisma.residentProfile.findMany({
      where,
      orderBy: [{ flat: { block: { name: 'asc' } } }, { flat: { flatNumber: 'asc' } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: residentListInclude,
    }),
    prisma.residentProfile.count({ where }),
    prisma.residentProfile.groupBy({
      by: ['residentType'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.block.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.flat.findMany({
      where: { deletedAt: null },
      orderBy: [{ block: { name: 'asc' } }, { flatNumber: 'asc' }],
      select: {
        id: true,
        flatNumber: true,
        occupancyStatus: true,
        block: { select: { name: true } },
        _count: { select: { residents: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  const owners = counts.find((row) => row.residentType === 'OWNER')?._count._all ?? 0;
  const tenants = counts.find((row) => row.residentType === 'TENANT')?._count._all ?? 0;

  const flatOptions = availableFlats.map((flat) => ({
    id: flat.id,
    label: `${flat.block.name}-${flat.flatNumber}`,
    occupancyStatus: flat.occupancyStatus,
    residentCount: flat._count.residents,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Residents"
        description="Onboard owners and tenants, update their details, and offboard them when they move out."
        actions={<ResidentManager flats={flatOptions} />}
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total residents" value={owners + tenants} icon={Users} />
        <StatCard label="Owners" value={owners} icon={Home} tone="info" />
        <StatCard label="Tenants" value={tenants} icon={UserCheck} tone="success" />
        <StatCard label="Occupied flats" value={availableFlats.filter((f) => f._count.residents > 0).length} />
      </section>

      <FilterBar
        searchPlaceholder="Search name, email, phone or flat…"
        filters={[
          { name: 'block', label: 'Block', options: blocks.map((b) => ({ value: b.id, label: `Block ${b.name}` })) },
          {
            name: 'type',
            label: 'Resident type',
            options: [
              { value: 'OWNER', label: 'Owner' },
              { value: 'TENANT', label: 'Tenant' },
            ],
          },
          {
            name: 'status',
            label: 'Account status',
            options: [
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ],
          },
        ]}
      />

      {residents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No residents match these filters"
          description="Clear the filters, or onboard a new resident to a flat."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resident</TableHead>
                  <TableHead>Flat</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {residents.map((resident) => (
                  <TableRow key={resident.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback>{initials(resident.user.fullName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium">{resident.user.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{resident.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {resident.flat.block.name}-{resident.flat.flatNumber}
                      {resident.isPrimary ? (
                        <Badge variant="soft" className="ml-2">
                          Primary
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={resident.residentType} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{resident.user.phone}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(resident.moveInDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={resident.user.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ResidentManager
                        flats={flatOptions}
                        resident={{
                          id: resident.id,
                          fullName: resident.user.fullName,
                          email: resident.user.email,
                          phone: resident.user.phone,
                          flatId: resident.flatId,
                          flatLabel: `${resident.flat.block.name}-${resident.flat.flatNumber}`,
                          residentType: resident.residentType,
                          isPrimary: resident.isPrimary,
                          moveInDate: toDateInputValue(resident.moveInDate),
                          occupation: resident.occupation,
                          alternatePhone: resident.alternatePhone,
                          status: resident.user.status,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {residents.map((resident) => (
              <Card key={resident.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback>{initials(resident.user.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{resident.user.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{resident.user.email}</p>
                    </div>
                    <StatusBadge status={resident.user.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">
                      Flat {resident.flat.block.name}-{resident.flat.flatNumber}
                    </Badge>
                    <StatusBadge status={resident.residentType} />
                    <span className="text-xs text-muted-foreground">{resident.user.phone}</span>
                  </div>

                  <div className="flex justify-end border-t border-border pt-3">
                    <ResidentManager
                      flats={flatOptions}
                      resident={{
                        id: resident.id,
                        fullName: resident.user.fullName,
                        email: resident.user.email,
                        phone: resident.user.phone,
                        flatId: resident.flatId,
                        flatLabel: `${resident.flat.block.name}-${resident.flat.flatNumber}`,
                        residentType: resident.residentType,
                        isPrimary: resident.isPrimary,
                        moveInDate: toDateInputValue(resident.moveInDate),
                        occupation: resident.occupation,
                        alternatePhone: resident.alternatePhone,
                        status: resident.user.status,
                      }}
                    />
                  </div>
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
