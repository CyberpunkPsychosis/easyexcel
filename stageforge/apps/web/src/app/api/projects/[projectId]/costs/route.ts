import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * 成本仪表盘：按环节/模型拆解花费 + 每分钟等效成本。
 * 口径说明（重要，来自调研教训）：这里是「实际已发生成本」，含所有重roll变体；
 * 预估成本请看单次生成前的 estimated 值，两者必须分开展示。
 */
export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(params.projectId, user.id, 'read');

    const groups = await prisma.creditLedger.groupBy({
      by: ['capability', 'adapterId', 'currency'],
      where: { projectId: params.projectId, kind: 'charge' },
      _sum: { deltaCents: true },
      _count: { _all: true },
    });

    const totals = await prisma.creditLedger.groupBy({
      by: ['currency'],
      where: { projectId: params.projectId, kind: 'charge' },
      _sum: { deltaCents: true },
    });

    // 每分钟等效成本：总花费 / 已有镜头总时长
    const shots = await prisma.shot.findMany({
      where: { scene: { episode: { projectId: params.projectId } } },
      select: { durationSec: true },
    });
    const totalSeconds = shots.reduce((acc, s) => acc + s.durationSec, 0);

    const rerollStats = await prisma.variant.groupBy({
      by: ['shotId', 'capability'],
      where: { shot: { scene: { episode: { projectId: params.projectId } } } },
      _count: { _all: true },
    });
    const rerollCounts = rerollStats.map((r) => r._count._all);
    const avgRolls =
      rerollCounts.length > 0 ? rerollCounts.reduce((a, b) => a + b, 0) / rerollCounts.length : 0;

    return NextResponse.json({
      groups: groups.map((g) => ({
        capability: g.capability,
        adapterId: g.adapterId,
        currency: g.currency,
        spentCents: -(g._sum.deltaCents ?? 0),
        jobs: g._count._all,
      })),
      totals: totals.map((t) => ({ currency: t.currency, spentCents: -(t._sum.deltaCents ?? 0) })),
      totalSeconds,
      avgRollsPerStage: Number(avgRolls.toFixed(2)),
    });
  } catch (e) {
    return handleError(e);
  }
}
