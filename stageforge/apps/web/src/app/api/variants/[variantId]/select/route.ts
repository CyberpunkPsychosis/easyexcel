import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** 变体选优：同一镜头同一环节只有一个 selected（合成时取它） */
export async function POST(_req: NextRequest, { params }: { params: { variantId: string } }) {
  try {
    const user = await requireUser();
    const variant = await prisma.variant.findUnique({
      where: { id: params.variantId },
      include: { shot: { include: { scene: { include: { episode: true } } } } },
    });
    if (!variant) notFound('变体不存在');
    await assertProjectAccess(variant.shot.scene.episode.projectId, user.id);

    await prisma.$transaction([
      prisma.variant.updateMany({
        where: { shotId: variant.shotId, capability: variant.capability },
        data: { selected: false },
      }),
      prisma.variant.update({ where: { id: variant.id }, data: { selected: true } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
