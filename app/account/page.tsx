import type { Metadata } from 'next';
import { Building2, Mail, Phone, ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { ProfileForm } from '@/app/account/profile-form';
import { Avatar, AvatarFallback } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/rbac';
import { formatDateTime, humanise, initials } from '@/lib/utils';

export const metadata: Metadata = { title: 'My Profile' };

export default async function AccountPage() {
  const user = await requireUser();

  const [account, resident, staff] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { fullName: true, email: true, phone: true, createdAt: true, lastLoginAt: true, status: true },
    }),
    user.residentId
      ? prisma.residentProfile.findUnique({
          where: { id: user.residentId },
          select: {
            occupation: true,
            alternatePhone: true,
            residentType: true,
            moveInDate: true,
            flat: { select: { flatNumber: true, block: { select: { name: true, label: true } } } },
          },
        })
      : null,
    user.staffId
      ? prisma.staffProfile.findUnique({
          where: { id: user.staffId },
          select: {
            employeeCode: true,
            department: true,
            designation: true,
            shift: true,
            gateAssignment: true,
            skills: true,
            joinedAt: true,
          },
        })
      : null,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Keep your contact details current — the society uses them for billing and emergencies."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>Changes take effect immediately across the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              defaults={{
                fullName: account.fullName,
                email: account.email,
                phone: account.phone,
                alternatePhone: resident?.alternatePhone ?? '',
                occupation: resident?.occupation ?? '',
              }}
              showResidentFields={Boolean(resident)}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <Avatar className="size-16">
                <AvatarFallback className="text-lg">{initials(account.fullName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{account.fullName}</p>
                <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role]}</p>
              </div>
              <Badge variant={account.status === 'ACTIVE' ? 'success' : 'muted'}>
                {humanise(account.status)}
              </Badge>
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[user.role]}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 break-all">{account.email}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{account.phone}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-muted-foreground">
                  Last signed in {formatDateTime(account.lastLoginAt)}
                </span>
              </div>
            </CardContent>
          </Card>

          {resident ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Building2 className="size-4 text-muted-foreground" aria-hidden />
                  Residence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Flat</span>
                  <span className="font-medium">
                    {resident.flat.block.name}-{resident.flat.flatNumber}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Block</span>
                  <span className="text-right font-medium">
                    {resident.flat.block.label ?? resident.flat.block.name}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{humanise(resident.residentType)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Resident since</span>
                  <span className="font-medium">{formatDateTime(resident.moveInDate)}</span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {staff ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Employment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ['Employee code', staff.employeeCode],
                  ['Designation', staff.designation],
                  ['Department', humanise(staff.department)],
                  ['Shift', staff.shift ?? '—'],
                  ...(staff.gateAssignment ? [['Gate', staff.gateAssignment]] : []),
                  ['Joined', formatDateTime(staff.joinedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-right font-medium">{value}</span>
                  </div>
                ))}
                {staff.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {staff.skills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
