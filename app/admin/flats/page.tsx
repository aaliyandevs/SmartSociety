import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { Building2, DoorClosed, DoorOpen, Wrench } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { DataPagination } from '@/components/shared/data-pagination';
import { FlatManager } from '@/app/admin/flats/flat-manager';
import { OccupancyMap } from '@/app/admin/flats/occupancy-map';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { formatCurrency, humanise } from '@/lib/utils';
import { flatListInclude, getOccupancyMap } from '@/services/society-service';

export const metadata: Metadata = { title: 'Flats & Units' };

const PAGE_SIZE = 20;

export default async function AdminFlatsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; block?: string; status?: string; page?: string }>;
}) {
  await requireRole('ADMIN');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.FlatWhereInput = {
    deletedAt: null,
    ...(params.block ? { blockId: params.block } : {}),
    ...(params.status
      ? { occupancyStatus: params.status as Prisma.EnumOccupancyStatusFilter['equals'] }
      : {}),
    ...(params.q
      ? {
          OR: [
            { flatNumber: { contains: params.q, mode: 'insensitive' } },
            { block: { name: { contains: params.q, mode: 'insensitive' } } },
            {
              residents: {
                some: {
                  deletedAt: null,
                  user: { fullName: { contains: params.q, mode: 'insensitive' } },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [flats, total, blocks, counts, occupancy] = await Promise.all([
    prisma.flat.findMany({
      where,
      orderBy: [{ block: { name: 'asc' } }, { floor: 'asc' }, { flatNumber: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: flatListInclude,
    }),
    prisma.flat.count({ where }),
    prisma.block.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.flat.groupBy({
      by: ['occupancyStatus'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    getOccupancyMap(),
  ]);

  const stats = { OCCUPIED: 0, VACANT: 0, UNDER_MAINTENANCE: 0 };
  for (const row of counts) stats[row.occupancyStatus] = row._count._all;
  const totalFlats = stats.OCCUPIED + stats.VACANT + stats.UNDER_MAINTENANCE;

  const blockOptions = blocks.map((block) => ({ value: block.id, label: `Block ${block.name}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Flats & units"
        description="Maintain the unit register, occupancy status and per-flat maintenance charges."
        actions={
          <FlatManager
            blocks={blocks.map((block) => ({
              id: block.id,
              name: block.name,
              totalFloors: block.totalFloors,
            }))}
          />
        }
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total units" value={totalFlats} icon={Building2} />
        <StatCard label="Occupied" value={stats.OCCUPIED} icon={DoorOpen} tone="success" />
        <StatCard label="Vacant" value={stats.VACANT} icon={DoorClosed} tone="warning" />
        <StatCard
          label="Under maintenance"
          value={stats.UNDER_MAINTENANCE}
          icon={Wrench}
          tone={stats.UNDER_MAINTENANCE > 0 ? 'destructive' : 'default'}
        />
      </section>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Unit list</TabsTrigger>
          <TabsTrigger value="map">Occupancy map</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <FilterBar
            searchPlaceholder="Search flat number, block or resident…"
            filters={[
              { name: 'block', label: 'Block', options: blockOptions },
              {
                name: 'status',
                label: 'Occupancy',
                options: [
                  { value: 'OCCUPIED', label: 'Occupied' },
                  { value: 'VACANT', label: 'Vacant' },
                  { value: 'UNDER_MAINTENANCE', label: 'Under maintenance' },
                ],
              },
            ]}
          />

          {flats.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No flats match these filters"
              description="Clear the filters, or add a new unit to the register."
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Residents</TableHead>
                      <TableHead>Vehicles</TableHead>
                      <TableHead className="text-right">Maintenance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flats.map((flat) => (
                      <TableRow key={flat.id}>
                        <TableCell>
                          <p className="font-medium">
                            {flat.block.name}-{flat.flatNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Floor {flat.floor}
                            {flat.carpetAreaSqft ? ` · ${flat.carpetAreaSqft} sq ft` : ''}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {humanise(flat.flatType)}
                        </TableCell>
                        <TableCell>
                          {flat.residents.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <div className="space-y-0.5">
                              {flat.residents.slice(0, 2).map((resident) => (
                                <p key={resident.id} className="text-sm">
                                  {resident.user.fullName}
                                  <span className="ml-1.5 text-xs text-muted-foreground">
                                    {humanise(resident.residentType)}
                                  </span>
                                </p>
                              ))}
                              {flat.residents.length > 2 ? (
                                <p className="text-xs text-muted-foreground">
                                  +{flat.residents.length - 2} more
                                </p>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {flat.vehicles.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {flat.vehicles.slice(0, 2).map((vehicle) => (
                                <Badge key={vehicle.id} variant="outline" className="font-mono text-[10px]">
                                  {vehicle.registrationNo}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="tabular whitespace-nowrap text-right">
                          {formatCurrency(flat.baseMaintenance)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={flat.occupancyStatus} />
                        </TableCell>
                        <TableCell className="text-right">
                          <FlatManager
                            blocks={blocks.map((block) => ({
                              id: block.id,
                              name: block.name,
                              totalFloors: block.totalFloors,
                            }))}
                            flat={{
                              id: flat.id,
                              blockId: flat.blockId,
                              flatNumber: flat.flatNumber,
                              floor: flat.floor,
                              flatType: flat.flatType,
                              carpetAreaSqft: flat.carpetAreaSqft,
                              occupancyStatus: flat.occupancyStatus,
                              parkingSlots: flat.parkingSlots,
                              baseMaintenance: Number(flat.baseMaintenance),
                              residentCount: flat.residents.length,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
                {flats.map((flat) => (
                  <Card key={flat.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {flat.block.name}-{flat.flatNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {humanise(flat.flatType)} · floor {flat.floor}
                          </p>
                        </div>
                        <StatusBadge status={flat.occupancyStatus} />
                      </div>

                      <div className="text-sm">
                        {flat.residents.length === 0 ? (
                          <p className="text-muted-foreground">No residents on record</p>
                        ) : (
                          flat.residents.map((resident) => (
                            <p key={resident.id}>
                              {resident.user.fullName}
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {humanise(resident.residentType)}
                              </span>
                            </p>
                          ))
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                        <span className="tabular text-sm font-medium">
                          {formatCurrency(flat.baseMaintenance)}
                        </span>
                        <FlatManager
                          blocks={blocks.map((block) => ({
                            id: block.id,
                            name: block.name,
                            totalFloors: block.totalFloors,
                          }))}
                          flat={{
                            id: flat.id,
                            blockId: flat.blockId,
                            flatNumber: flat.flatNumber,
                            floor: flat.floor,
                            flatType: flat.flatType,
                            carpetAreaSqft: flat.carpetAreaSqft,
                            occupancyStatus: flat.occupancyStatus,
                            parkingSlots: flat.parkingSlots,
                            baseMaintenance: Number(flat.baseMaintenance),
                            residentCount: flat.residents.length,
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
        </TabsContent>

        <TabsContent value="map">
          <OccupancyMap blocks={occupancy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
