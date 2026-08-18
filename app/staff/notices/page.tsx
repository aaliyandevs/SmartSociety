import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { NoticeBoard } from '@/components/shared/notice-board';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { visibleNoticeWhere } from '@/services/community-service';

export const metadata: Metadata = { title: 'Notices' };

export default async function StaffNoticesPage() {
  const user = await requireRole('MAINTENANCE_STAFF', 'ADMIN');

  const notices = await prisma.notice.findMany({
    where: visibleNoticeWhere(user.role === 'ADMIN' ? 'MAINTENANCE_STAFF' : user.role),
    orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
    take: 40,
    include: { author: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Notice board"
        description="Announcements relevant to staff and the wider society."
      />
      <NoticeBoard notices={notices} />
    </div>
  );
}
