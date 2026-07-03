import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** 成片列表：按剧集分组的 final 资产（含语言标记），工作台成片行的数据源 */
export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(params.projectId, user.id);
    const finals = await prisma.asset.findMany({
      where: { projectId: params.projectId, kind: 'final' },
      orderBy: { createdAt: 'desc' },
    });
    const exportsList = finals.map((a) => {
      const meta = a.meta as { episodeId?: string; lang?: string; hasMusic?: boolean };
      return {
        assetId: a.id,
        episodeId: meta.episodeId ?? null,
        lang: meta.lang ?? '',
        hasMusic: Boolean(meta.hasMusic),
        createdAt: a.createdAt,
      };
    });
    return NextResponse.json({ exports: exportsList });
  } catch (e) {
    return handleError(e);
  }
}
