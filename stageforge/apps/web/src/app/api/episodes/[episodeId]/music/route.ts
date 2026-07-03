import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { GENERATION_QUEUE, getQueue } from '@stageforge/core';
import { getAdapter } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';
import { resolveAdapterId } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

const schema = z.object({
  prompt: z.string().max(500).optional(),
  adapterId: z.string().optional(),
});

/** 整集配乐：audio.music 任务成功后回写 Episode.musicAssetId，合成时自动混音 */
export async function POST(req: NextRequest, { params }: { params: { episodeId: string } }) {
  try {
    const user = await requireUser();
    const episode = await prisma.episode.findUnique({
      where: { id: params.episodeId },
      include: { scenes: { include: { shots: { select: { durationSec: true, emotion: true } } } } },
    });
    if (!episode) notFound('剧集不存在');
    await assertProjectAccess(episode.projectId, user.id);
    const body = schema.parse((await req.json().catch(() => ({}))) ?? {});

    const shots = episode.scenes.flatMap((s) => s.shots);
    const durationSec = Math.min(240, Math.max(15, shots.reduce((a, s) => a + s.durationSec, 0)));
    const emotions = [...new Set(shots.map((s) => s.emotion))].slice(0, 4).join('、');

    const adapterId = body.adapterId ?? (await resolveAdapterId(episode.projectId, 'audio.music'));
    const adapter = getAdapter(adapterId);
    const input = {
      prompt:
        body.prompt ??
        `竖屏微短剧《${episode.title}》BGM，情绪线：${emotions || '紧张-反转-爽感'}，节奏跟随剧情推进，无人声`,
      durationSec,
    };
    const estimated = adapter.estimateCost(input);
    const job = await prisma.generationJob.create({
      data: {
        projectId: episode.projectId,
        episodeId: episode.id,
        capability: 'audio.music',
        adapterId,
        input,
        estimatedCostCents: estimated.cents,
        currency: estimated.currency,
      },
    });
    await getQueue(GENERATION_QUEUE).add('music', { jobId: job.id });
    return NextResponse.json({ job }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}
