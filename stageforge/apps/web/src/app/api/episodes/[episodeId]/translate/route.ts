import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { GENERATION_QUEUE, getQueue } from '@stageforge/core';
import { getAdapter } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, badRequest, handleError, notFound } from '@/lib/server';
import { resolveAdapterId } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

const SEPARATOR = '\n@@@\n';

const schema = z.object({
  targetLang: z.string().min(2).max(10),
  adapterId: z.string().optional(),
});

/**
 * 出海本地化第一步：整集台词批量翻译（一次 LLM 调用，分隔符对齐回写）。
 * 完成后可用「合成」的 lang 参数直接产出对应语种字幕的成片。
 * 调研核验：AI 译制把 100 集译期压到 12 小时内、约 50 元/分钟，是全流程 ROI 最高的环节。
 */
export async function POST(req: NextRequest, { params }: { params: { episodeId: string } }) {
  try {
    const user = await requireUser();
    const episode = await prisma.episode.findUnique({
      where: { id: params.episodeId },
      include: {
        scenes: { orderBy: { index: 'asc' }, include: { shots: { orderBy: { index: 'asc' } } } },
      },
    });
    if (!episode) notFound('剧集不存在');
    await assertProjectAccess(episode.projectId, user.id);
    const body = schema.parse(await req.json());

    const shotsWithDialogue = episode.scenes
      .flatMap((s) => s.shots)
      .filter((sh) => sh.dialogue.trim().length > 0);
    if (shotsWithDialogue.length === 0) badRequest('该集没有任何台词可翻译');

    const adapterId = body.adapterId ?? (await resolveAdapterId(episode.projectId, 'text.translate'));
    const adapter = getAdapter(adapterId);
    // 纯台词 + 分隔符；「逐段翻译保持 @@@ 分隔」的指令在 translate 适配器的提示词里
    const input = {
      text: shotsWithDialogue.map((sh) => sh.dialogue).join(SEPARATOR),
      targetLang: body.targetLang,
      shotIds: shotsWithDialogue.map((sh) => sh.id),
      separator: SEPARATOR,
    };
    const estimated = adapter.estimateCost(input);
    const job = await prisma.generationJob.create({
      data: {
        projectId: episode.projectId,
        episodeId: episode.id,
        capability: 'text.translate',
        adapterId,
        input,
        estimatedCostCents: estimated.cents,
        currency: estimated.currency,
      },
    });
    await getQueue(GENERATION_QUEUE).add('translate', { jobId: job.id });
    return NextResponse.json({ job, lines: shotsWithDialogue.length }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}
