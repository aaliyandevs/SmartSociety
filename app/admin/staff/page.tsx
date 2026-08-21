import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { HardHat, ShieldCheck, Wrench } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { FilterBar } from '@/components/shared/filter-bar';
import { StaffManager } from '@/app/admin/staff/staff-manager';
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
import { formatDate, humanise, initials, pluralize } from '@/lib/utils';
import { staffListInclude } from '@/services/society-service';

export const metadata: Metadata = { title: 'Maintenance Staff' };

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string; role?: string }>;
}) {
  await requireRole('ADMIN');
  const params = await searchParams;

  const where: Prisma.StaffProfileWhereInput = {
    deletedAt: null,
    ...(params.department
      ? { department: params.department as Prisma.EnumStaffDepartmentFilter['equals'] }
      : {}),
    ...(params.role ? { user: { role: params.role as Prisma.EnumRoleFilter['equals'] } } : {}),
    ...(params.q
      ? {
          OR: [
            { user: { fullName: { contains: params.q, mode: 'insensitive' } } },
            { employeeCode: { contains: params.q, mode: 'insensitive' } },
            { designation: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [staff, guards, technicians, openTickets] = await Promise.all([
    prisma.staffProfile.findMany({
      where,
      orderBy: [{ department: 'asc' }, { user: { fullName: 'asc' } }],
      include: staffListInclude,
    }),
    prisma.staffProfile.count({ where: { deletedAt: null, user: { role: 'GUARD' } } }),
    prisma.staffProfile.count({ where: { deletedAt: null, user: { role: 'MAINTENANCE_STAFF' } } }),
    prisma.complaint.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, deletedAt: null } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Staff directory"
        description="Security guards and maintenance technicians, their departments and current workload."
        actions={<StaffManager />}
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total staff" value={guards + technicians} icon={HardHat} />
        <StatCard label="Security guards" value={guards} icon={ShieldCheck} tone="info" />
        <StatCard label="Technicians" value={technicians} icon={Wrench} tone="success" />
        <StatCard
          label="Open tickets"
          value={openTickets}
          hint="Across all technicians"
          tone={openTickets > 0 ? 'warning' : 'default'}
          href="/admin/complaints"
        />
      </section>

      <FilterBar
        searchPlaceholder="Search name, code or designation…"
        filters={[
          {
            name: 'role',
            label: 'Role',
            options: [
              { value: 'GUARD', label: 'Security guard' },
              { value: 'MAINTENANCE_STAFF', label: 'Maintenance staff' },
            ],
          },
          {
            name: 'department',
            label: 'Department',
            options: [
              { value: 'PLUMBING', label: 'Plumbing' },
              { value: 'ELECTRICAL', label: 'Electrical' },
              { value: 'ELEVATOR', label: 'Elevator' },
              { value: 'HOUSEKEEPING', label: 'Housekeeping' },
              { value: 'GARDENING', label: 'Gardening' },
              { value: 'SECURITY', label: 'Security' },
              { value: 'GENERAL', label: 'General' },
            ],
          },
        ]}
      />

      {staff.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="No staff match these filters"
          description="Clear the filters, or add a new staff member to the directory."
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff member</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Shift / posting</TableHead>
                  <TableHead>Open tickets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback>{initials(member.user.fullName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium">{member.user.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.designation} · {member.user.phone}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {member.employeeCode}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{humanise(member.department)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p>{member.shift ?? '—'}</p>
                      {member.gateAssignment ? (
                        <p className="text-xs text-muted-foreground">{member.gateAssignment}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular text-sm">
                      {member.user.role === 'MAINTENANCE_STAFF' ? member._count.assignedComplaints : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={member.user.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <StaffManager
                        staff={{
                          id: member.id,
                          fullName: member.user.fullName,
                          email: member.user.email,
                          phone: member.user.phone,
                          role: member.user.role,
                          department: member.department,
                          designation: member.designation,
                          shift: member.shift,
                          gateAssignment: member.gateAssignment,
                          skills: member.skills,
                          status: member.user.status,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {staff.map((member) => (
              <Card key={member.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback>{initials(member.user.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{member.user.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.designation}</p>
                    </div>
                    <StatusBadge status={member.user.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{humanise(member.department)}</Badge>
                    <Badge variant="muted" className="font-mono text-[10px]">
                      {member.employeeCode}
                    </Badge>
                    {member.user.role === 'MAINTENANCE_STAFF' ? (
                      <span className="text-xs text-muted-foreground">
                        {pluralize(member._count.assignedComplaints, 'open ticket')}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {[member.shift, member.gateAssignment].filter(Boolean).join(' · ') || '—'} · joined{' '}
                    {formatDate(member.joinedAt)}
                  </p>

                  <div className="flex justify-end border-t border-border pt-3">
                    <StaffManager
                      staff={{
                        id: member.id,
                        fullName: member.user.fullName,
                        email: member.user.email,
                        phone: member.user.phone,
                        role: member.user.role,
                        department: member.department,
                        designation: member.designation,
                        shift: member.shift,
                        gateAssignment: member.gateAssignment,
                        skills: member.skills,
                        status: member.user.status,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
