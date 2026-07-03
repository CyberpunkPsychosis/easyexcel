import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';
import { runComplianceCheck } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

const schema = z.object({
  /** 顺带切换 AI 水印开关（切换后立即重检） */
  watermark: z.boolean().optional(),
});

/** 备案合规检查（也是合成前卡点的手动入口） */
export async function POST(req: NextRequest, { params }: { params: { episodeId: string } }) {
  try {
    const user = await requireUser();
    const episode = await prisma.episode.findUnique({ where: { id: params.episodeId } });
    if (!episode) notFound('剧集不存在');
    await assertProjectAccess(episode.projectId, user.id);
    const body = schema.parse((await req.json().catch(() => ({}))) ?? {});
    if (body.watermark !== undefined) {
      await prisma.episode.update({ where: { id: episode.id }, data: { watermark: body.watermark } });
    }
    const report = await runComplianceCheck(episode.id);
    return NextResponse.json({ report });
  } catch (e) {
    return handleError(e);
  }
}
