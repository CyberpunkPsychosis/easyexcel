import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { GENERATION_QUEUE, getQueue, type Capability } from '@stageforge/core';
import { getAdapter } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { getShotWithAccess, handleError } from '@/lib/server';
import { buildStageInput, resolveAdapterId } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

const schema = z.object({
  capability: z.enum([
    'image.t2i',
    'image.character',
    'video.i2v',
    'video.t2v',
    'audio.tts',
    'audio.voiceclone',
    'audio.lipsync',
  ]),
  /** 一次性覆盖（A/B 对比用）：不落 ShotStage，只影响本次生成 */
  adapterId: z.string().optional(),
});

/**
 * 镜头级生成/重roll：每次调用产出一个新变体。
 * A/B 竞技场 = 对同一镜头带不同 adapterId 调两次本接口。
 */
export async function POST(req: NextRequest, { params }: { params: { shotId: string } }) {
  try {
    const user = await requireUser();
    const { shot, project } = await getShotWithAccess(params.shotId, user.id);
    const body = schema.parse(await req.json());
    const capability = body.capability as Capability;

    const adapterId =
      body.adapterId ?? (await resolveAdapterId(project.id, capability, shot.stages));
    const adapter = getAdapter(adapterId);
    const input = await buildStageInput(capability, shot);
    const estimated = adapter.estimateCost(input);

    const job = await prisma.generationJob.create({
      data: {
        projectId: project.id,
        shotId: shot.id,
        capability,
        adapterId,
        input,
        estimatedCostCents: estimated.cents,
        currency: estimated.currency,
      },
    });
    await getQueue(GENERATION_QUEUE).add('generate', { jobId: job.id });
    return NextResponse.json({ job }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}
