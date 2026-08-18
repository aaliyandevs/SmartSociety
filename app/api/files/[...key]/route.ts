import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { readUpload } from '@/services/upload-service';

/**
 * Authenticated file serving for complaint photos.
 *
 * Uploads deliberately do not live under /public: every request is checked
 * against the complaint's owner, the assigned technician, or an administrator
 * (NFR: Data Privacy & Security).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const storageKey = key.join('/');

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const attachment = await prisma.complaintAttachment.findFirst({
    where: { storageKey },
    select: {
      mimeType: true,
      fileName: true,
      complaint: { select: { residentId: true, assignedStaffId: true } },
    },
  });

  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed =
    user.role === 'ADMIN' ||
    (user.role === 'RESIDENT' && attachment.complaint.residentId === user.residentId) ||
    (user.role === 'MAINTENANCE_STAFF' && attachment.complaint.assignedStaffId === user.staffId);

  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const buffer = await readUpload(storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': attachment.mimeType,
        // `inline` so the browser can preview it, but never execute it.
        'Content-Disposition': `inline; filename="${attachment.fileName.replace(/"/g, '')}"`,
        'Content-Security-Policy': "default-src 'none'; img-src 'self'",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File is no longer available' }, { status: 404 });
  }
}
