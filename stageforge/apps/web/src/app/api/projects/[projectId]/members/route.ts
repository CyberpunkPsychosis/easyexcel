import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, badRequest, handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    const project = await assertProjectAccess(params.projectId, user.id, 'read');
    const members = await prisma.projectMember.findMany({
      where: { projectId: params.projectId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const owner = await prisma.user.findUnique({
      where: { id: project.ownerId },
      select: { id: true, email: true, name: true },
    });
    return NextResponse.json({ owner, members });
  } catch (e) {
    return handleError(e);
  }
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']).default('editor'),
});

/** 邀请成员（仅 owner）：按邮箱邀请已注册用户 */
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    const project = await assertProjectAccess(params.projectId, user.id);
    if (project.ownerId !== user.id) {
      throw Object.assign(new Error('只有项目所有者可以管理成员'), { status: 403 });
    }
    const body = inviteSchema.parse(await req.json());
    const invitee = await prisma.user.findUnique({ where: { email: body.email } });
    if (!invitee) badRequest(`用户 ${body.email} 不存在（M4 仅支持邀请已注册用户）`);
    if (invitee.id === project.ownerId) badRequest('不能邀请项目所有者自己');
    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: params.projectId, userId: invitee.id } },
      create: { projectId: params.projectId, userId: invitee.id, role: body.role },
      update: { role: body.role },
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
