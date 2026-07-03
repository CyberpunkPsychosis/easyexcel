import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { COMPOSE_QUEUE, getQueue } from '@stageforge/core';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';
import { runComplianceCheck } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

/**
 * 多语成片批量导出：原文 + 该集所有已翻译语种，各排一个合成任务。
 * 一套素材（选中变体 + BGM）出 N 个语言版本 —— 出海分发的最后一公里。
 */
export async function POST(_req: NextRequest, { params }: { params: { episodeId: string } }) {
  try {
    const user = await requireUser();
    const episode = await prisma.episode.findUnique({
      where: { id: params.episodeId },
      include: { scenes: { include: { shots: { select: { translations: true } } } } },
    });
    if (!episode) notFound('剧集不存在');
    await assertProjectAccess(episode.projectId, user.id);

    // 备案合规卡点：出海批量导出同样受控
    const status =
      episode.complianceStatus === 'pending'
        ? (await runComplianceCheck(episode.id)).status
        : episode.complianceStatus;
    if (status === 'blocked') {
      throw Object.assign(new Error('合规检查未通过，禁止导出（详见设置页报告）'), { status: 422 });
    }

    const langs = new Set<string>();
    for (const scene of episode.scenes) {
      for (const shot of scene.shots) {
        for (const lang of Object.keys(shot.translations as Record<string, string>)) langs.add(lang);
      }
    }

    const queue = getQueue(COMPOSE_QUEUE);
    const targets = ['', ...langs]; // '' = 原文
    for (const lang of targets) {
      const job = await prisma.generationJob.create({
        data: {
          projectId: episode.projectId,
          episodeId: episode.id,
          capability: 'render.compose',
          adapterId: 'internal-ffmpeg',
          input: { episodeId: episode.id, ...(lang ? { lang } : {}) },
        },
      });
      await queue.add('compose', { jobId: job.id });
    }
    return NextResponse.json({ enqueued: targets.length, langs: targets }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}
