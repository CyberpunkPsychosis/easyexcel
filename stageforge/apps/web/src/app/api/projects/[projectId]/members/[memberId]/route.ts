import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** 移除成员（仅 owner，成员也可自己退出） */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { projectId: string; memberId: string } },
) {
  try {
    const user = await requireUser();
    const project = await assertProjectAccess(params.projectId, user.id, 'read');
    const member = await prisma.projectMember.findUnique({ where: { id: params.memberId } });
    if (!member || member.projectId !== params.projectId) notFound('成员不存在');
    const isOwner = project.ownerId === user.id;
    const isSelf = member.userId === user.id;
    if (!isOwner && !isSelf) {
      throw Object.assign(new Error('只有项目所有者可以移除其他成员'), { status: 403 });
    }
    await prisma.projectMember.delete({ where: { id: params.memberId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
