import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** 最近任务（工作台轮询用）：进行中 + 最近 20 条 */
export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(params.projectId, user.id, 'read');
    const jobs = await prisma.generationJob.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        capability: true,
        adapterId: true,
        status: true,
        error: true,
        shotId: true,
        episodeId: true,
        estimatedCostCents: true,
        actualCostCents: true,
        currency: true,
        createdAt: true,
        finishedAt: true,
      },
    });
    return NextResponse.json({ jobs });
  } catch (e) {
    return handleError(e);
  }
}
