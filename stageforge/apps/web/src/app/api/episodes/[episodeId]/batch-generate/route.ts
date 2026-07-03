import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { GENERATION_QUEUE, getQueue, type Capability } from '@stageforge/core';
import { getAdapter } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';
import { buildStageInput, resolveAdapterId } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

const schema = z.object({
  capability: z.enum(['image.t2i', 'video.i2v', 'audio.tts', 'audio.lipsync']),
  /** 默认跳过已有变体的镜头；true 则全部重roll */
  force: z.boolean().optional(),
});

/** 整集批量生成：对该集所有镜头的某个环节一键排队（工业化产能的入口） */
export async function POST(req: NextRequest, { params }: { params: { episodeId: string } }) {
  try {
    const user = await requireUser();
    const episode = await prisma.episode.findUnique({
      where: { id: params.episodeId },
      include: {
        scenes: {
          orderBy: { index: 'asc' },
          include: {
            shots: {
              orderBy: { index: 'asc' },
              include: { stages: true, variants: { include: { asset: true } } },
            },
          },
        },
      },
    });
    if (!episode) notFound('剧集不存在');
    await assertProjectAccess(episode.projectId, user.id);
    const body = schema.parse(await req.json());
    const capability = body.capability as Capability;

    let enqueued = 0;
    const skipped: { shotIndex: number; reason: string }[] = [];
    const queue = getQueue(GENERATION_QUEUE);

    for (const scene of episode.scenes) {
      for (const shot of scene.shots) {
        if (!body.force && shot.variants.some((v) => v.capability === capability)) {
          skipped.push({ shotIndex: shot.index, reason: '已有变体（force=true 可重roll）' });
          continue;
        }
        try {
          const adapterId = await resolveAdapterId(episode.projectId, capability, shot.stages);
          const adapter = getAdapter(adapterId);
          const input = await buildStageInput(capability, shot);
          const estimated = adapter.estimateCost(input);
          const job = await prisma.generationJob.create({
            data: {
              projectId: episode.projectId,
              shotId: shot.id,
              capability,
              adapterId,
              input,
              estimatedCostCents: estimated.cents,
              currency: estimated.currency,
            },
          });
          await queue.add('batch-generate', { jobId: job.id });
          enqueued += 1;
        } catch (e) {
          skipped.push({ shotIndex: shot.index, reason: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    return NextResponse.json({ enqueued, skipped }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}
