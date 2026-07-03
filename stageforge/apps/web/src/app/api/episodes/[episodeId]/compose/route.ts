import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { COMPOSE_QUEUE, getQueue } from '@stageforge/core';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** 整集合成：拼接每镜选中的视频变体 → 烧字幕（lang 可选出海译文）→ 混 BGM → 9:16 成片 */
export async function POST(req: NextRequest, { params }: { params: { episodeId: string } }) {
  try {
    const user = await requireUser();
    const episode = await prisma.episode.findUnique({ where: { id: params.episodeId } });
    if (!episode) notFound('剧集不存在');
    await assertProjectAccess(episode.projectId, user.id);
    const body = (await req.json().catch(() => ({}))) as { lang?: string };

    const job = await prisma.generationJob.create({
      data: {
        projectId: episode.projectId,
        episodeId: episode.id,
        capability: 'render.compose',
        adapterId: 'internal-ffmpeg',
        input: { episodeId: episode.id, ...(body.lang ? { lang: body.lang } : {}) },
      },
    });
    await getQueue(COMPOSE_QUEUE).add('compose', { jobId: job.id });
    return NextResponse.json({ job }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}
