import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { publicEnv } from '@/lib/env';
import { humanise } from '@/lib/utils';
import { buildGatePassPdf } from '@/services/pdf-service';
import { renderQrDataUrl } from '@/services/qr-service';

/** Printable A5 gate pass. Only the host resident or an administrator may fetch it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pass = await prisma.gatePass.findUnique({
    where: { id },
    include: {
      visitor: true,
      flat: { include: { block: true } },
      resident: { include: { user: { select: { fullName: true } } } },
    },
  });

  if (!pass) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed =
    user.role === 'ADMIN' ||
    user.role === 'GUARD' ||
    (user.role === 'RESIDENT' && pass.residentId === user.residentId);

  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const pdf = await buildGatePassPdf({
    societyName: publicEnv.societyName,
    passCode: pass.passCode,
    gateCode: pass.gateCode,
    visitorName: pass.visitor.name,
    visitorPhone: pass.visitor.phone,
    visitorType: humanise(pass.visitorType),
    vehicleNumber: pass.visitor.vehicleNumber,
    flatLabel: `${pass.flat.block.name}-${pass.flat.flatNumber}`,
    hostName: pass.resident.user.fullName,
    purpose: pass.purpose,
    validFrom: pass.validFrom,
    validUntil: pass.validUntil,
    qrDataUrl: await renderQrDataUrl(pass.qrToken, 400),
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="gate-pass-${pass.passCode}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
