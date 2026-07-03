import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { COMPOSE_QUEUE, getQueue } from '@stageforge/core';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';
import { runComplianceCheck } from '@/lib/compliance';

export const dynamic = 'force-dynamic';

/** 整集合成：合规卡点 → 拼接每镜选中的视频变体 → 烧字幕（lang 可选出海译文）→ 混 BGM → 9:16 成片 */
export async function POST(req: NextRequest, { params }: { params: { episodeId: string } }) {
  try {
    const user = await requireUser();
    const episode = await prisma.episode.findUnique({ where: { id: params.episodeId } });
    if (!episode) notFound('剧集不存在');
    await assertProjectAccess(episode.projectId, user.id);
    const body = (await req.json().catch(() => ({}))) as { lang?: string };

    // 备案合规卡点（M4）：未检自动先检，blocked 拒绝合成
    const status =
      episode.complianceStatus === 'pending'
        ? (await runComplianceCheck(episode.id)).status
        : episode.complianceStatus;
    if (status === 'blocked') {
      throw Object.assign(
        new Error('合规检查未通过，禁止合成。到「设置」页查看报告：补备案号/开启 AI 水印/修改违规台词后重检。'),
        { status: 422 },
      );
    }

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
