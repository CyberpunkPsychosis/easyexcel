import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { GENERATION_QUEUE, getQueue } from '@stageforge/core';
import { getAdapter } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError } from '@/lib/server';
import { resolveAdapterId } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

const schema = z.object({
  script: z.string().min(10).max(100_000),
  adapterId: z.string().optional(),
  guidance: z.string().max(2000).optional(),
  /** 模板市场：套用爆款结构模板（guidance 注入分镜提示词） */
  templateId: z.string().optional(),
});

/** 剧本 → 分镜表（异步任务；LLM 适配器可任选，见 registry?capability=text.storyboard） */
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(params.projectId, user.id);
    const body = schema.parse(await req.json());

    const adapterId = body.adapterId ?? (await resolveAdapterId(params.projectId, 'text.storyboard'));
    const adapter = getAdapter(adapterId);
    const characters = await prisma.character.findMany({ where: { projectId: params.projectId } });

    let guidance = body.guidance ?? '';
    if (body.templateId) {
      const template = await prisma.template.findUnique({ where: { id: body.templateId } });
      if (template) {
        guidance = [template.guidance, guidance].filter(Boolean).join('\n');
        await prisma.template.update({
          where: { id: template.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }

    const input = {
      script: body.script,
      guidance,
      characterNames: characters.map((c) => c.name),
    };
    const estimated = adapter.estimateCost(input);
    const job = await prisma.generationJob.create({
      data: {
        projectId: params.projectId,
        capability: 'text.storyboard',
        adapterId,
        input,
        estimatedCostCents: estimated.cents,
        currency: estimated.currency,
      },
    });
    await getQueue(GENERATION_QUEUE).add('storyboard', { jobId: job.id });
    return NextResponse.json({ job }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}
