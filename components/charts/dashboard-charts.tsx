'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCompactCurrency, formatCurrency, humanise } from '@/lib/utils';

/**
 * Charts for the administrator dashboard and reports.
 *
 * Colours come from the design tokens (--chart-1..5) so the palette follows the
 * light/dark theme instead of being hard-coded per chart.
 */

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const axisProps = {
  stroke: 'var(--muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({
  active,
  payload,
  label,
  currency = true,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {label !== undefined ? <p className="mb-1 font-medium">{label}</p> : null}
      {payload.map((entry, index) => (
        <p key={index} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
          <span>{entry.name}</span>
          <span className="tabular ml-auto font-medium text-foreground">
            {currency ? formatCurrency(Number(entry.value)) : String(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export interface TrendPoint {
  label: string;
  billed: number;
  collected: number;
  outstanding: number;
}

export function CollectionTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="billedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.34} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(value) => formatCompactCurrency(Number(value))} />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Area
          type="monotone"
          dataKey="billed"
          name="Billed"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#billedGradient)"
        />
        <Area
          type="monotone"
          dataKey="collected"
          name="Collected"
          stroke="var(--chart-2)"
          strokeWidth={2}
          fill="url(#collectedGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ComplaintCategoryChart({
  data,
}: {
  data: { category: string; count: number }[];
}) {
  const shaped = data.slice(0, 7).map((row) => ({ name: humanise(row.category), count: row.count }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={shaped} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="name" {...axisProps} width={96} />
        <Tooltip content={<ChartTooltip currency={false} />} cursor={{ fill: 'var(--muted)' }} />
        <Bar dataKey="count" name="Tickets" radius={[0, 6, 6, 0]} barSize={16}>
          {shaped.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OccupancyDonut({
  occupied,
  vacant,
  underMaintenance,
}: {
  occupied: number;
  vacant: number;
  underMaintenance: number;
}) {
  const data = [
    { name: 'Occupied', value: occupied, color: 'var(--chart-2)' },
    { name: 'Vacant', value: vacant, color: 'var(--chart-3)' },
    { name: 'Under maintenance', value: underMaintenance, color: 'var(--chart-5)' },
  ].filter((entry) => entry.value > 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={54}
          outerRadius={84}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip currency={false} />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function GateTrafficChart({
  data,
}: {
  data: { label: string; entries: number; exits: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} width={36} />
        <Tooltip content={<ChartTooltip currency={false} />} cursor={{ fill: 'var(--muted)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="entries" name="Entries" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={14} />
        <Bar dataKey="exits" name="Exits" fill="var(--chart-2)" radius={[4, 4, 0, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}
