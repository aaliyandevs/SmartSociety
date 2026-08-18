import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/misc';
import { cn, humanise } from '@/lib/utils';

interface MapFlat {
  id: string;
  flatNumber: string;
  floor: number;
  flatType: string;
  occupancyStatus: string;
  residents: { id: string; residentType: string; user: { fullName: string } }[];
  _count: { vehicles: number };
}

interface MapBlock {
  id: string;
  name: string;
  label: string | null;
  floors: { floor: number; flats: MapFlat[] }[];
  occupied: number;
  vacant: number;
  total: number;
}

const STATUS_STYLES: Record<string, string> = {
  OCCUPIED: 'border-success/50 bg-success/12 text-foreground',
  VACANT: 'border-dashed border-border bg-muted/40 text-muted-foreground',
  UNDER_MAINTENANCE: 'border-warning/60 bg-warning/15 text-foreground',
};

/**
 * Visual occupancy map (SRS §1.6, Administration #1 — "maintain flat occupancy
 * status maps"). Floors run top-down so the layout reads like the building.
 */
export function OccupancyMap({ blocks }: { blocks: MapBlock[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {[
          ['OCCUPIED', 'Occupied'],
          ['VACANT', 'Vacant'],
          ['UNDER_MAINTENANCE', 'Under maintenance'],
        ].map(([status, label]) => (
          <span key={status} className="inline-flex items-center gap-2">
            <span className={cn('size-3 rounded border', STATUS_STYLES[status])} aria-hidden />
            {label}
          </span>
        ))}
      </div>

      {blocks.map((block) => (
        <Card key={block.id}>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Block {block.name}</CardTitle>
              <CardDescription>{block.label ?? `${block.total} units`}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{block.occupied} occupied</Badge>
              <Badge variant="muted">{block.vacant} vacant</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-2">
            {block.floors.map(({ floor, flats }) => (
              <div key={floor} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
                  Floor {floor}
                </span>
                <div className="scroll-x flex flex-1 gap-2 pb-1">
                  {flats.map((flat) => {
                    const primary = flat.residents[0];
                    return (
                      <Tooltip key={flat.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'min-w-24 shrink-0 cursor-default rounded-lg border p-2.5 text-center transition-transform hover:scale-[1.03]',
                              STATUS_STYLES[flat.occupancyStatus] ?? STATUS_STYLES.VACANT,
                            )}
                          >
                            <p className="text-sm font-semibold">
                              {block.name}-{flat.flatNumber}
                            </p>
                            <p className="mt-0.5 truncate text-[10px]">
                              {primary ? primary.user.fullName.split(' ')[0] : 'Vacant'}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">
                            Flat {block.name}-{flat.flatNumber} · {humanise(flat.flatType)}
                          </p>
                          <p>{humanise(flat.occupancyStatus)}</p>
                          {flat.residents.length > 0 ? (
                            <p>
                              {flat.residents
                                .map(
                                  (resident) =>
                                    `${resident.user.fullName} (${humanise(resident.residentType)})`,
                                )
                                .join(', ')}
                            </p>
                          ) : (
                            <p>No residents on record</p>
                          )}
                          <p>
                            {flat._count.vehicles} vehicle{flat._count.vehicles === 1 ? '' : 's'} registered
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
