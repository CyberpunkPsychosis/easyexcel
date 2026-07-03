import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * 数据分析（M4）：生产侧指标 ——
 * 成功率（真实成片率 vs 行业熟手 ~20% 的对照）、各环节均耗时、
 * 成本日趋势、模型用量占比、重roll分布。
 */
export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(params.projectId, user.id, 'read');
    const projectId = params.projectId;

    const statusGroups = await prisma.generationJob.groupBy({
      by: ['capability', 'status'],
      where: { projectId },
      _count: { _all: true },
    });

    const doneJobs = await prisma.generationJob.findMany({
      where: { projectId, status: 'succeeded', startedAt: { not: null }, finishedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { capability: true, startedAt: true, finishedAt: true },
    });
    const durByCap = new Map<string, { total: number; n: number }>();
    for (const j of doneJobs) {
      const ms = j.finishedAt!.getTime() - j.startedAt!.getTime();
      const e = durByCap.get(j.capability) ?? { total: 0, n: 0 };
      e.total += ms;
      e.n += 1;
      durByCap.set(j.capability, e);
    }

    const ledger = await prisma.creditLedger.findMany({
      where: { projectId, kind: 'charge' },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: { createdAt: true, deltaCents: true, currency: true, adapterId: true },
    });
    const byDay = new Map<string, Record<string, number>>();
    const byAdapter = new Map<string, Record<string, number>>();
    for (const row of ledger) {
      const day = row.createdAt.toISOString().slice(0, 10);
      const d = byDay.get(day) ?? {};
      d[row.currency] = (d[row.currency] ?? 0) - row.deltaCents;
      byDay.set(day, d);
      const key = row.adapterId ?? 'unknown';
      const a = byAdapter.get(key) ?? {};
      a[row.currency] = (a[row.currency] ?? 0) - row.deltaCents;
      byAdapter.set(key, a);
    }

    const rerolls = await prisma.variant.groupBy({
      by: ['shotId', 'capability'],
      where: { shot: { scene: { episode: { projectId } } } },
      _count: { _all: true },
    });
    const rerollHist = { r1: 0, r2: 0, r3: 0, r4plus: 0 };
    for (const r of rerolls) {
      const n = r._count._all;
      if (n === 1) rerollHist.r1 += 1;
      else if (n === 2) rerollHist.r2 += 1;
      else if (n === 3) rerollHist.r3 += 1;
      else rerollHist.r4plus += 1;
    }

    return NextResponse.json({
      statusGroups: statusGroups.map((g) => ({
        capability: g.capability,
        status: g.status,
        count: g._count._all,
      })),
      avgDurationMs: [...durByCap.entries()].map(([capability, v]) => ({
        capability,
        avgMs: Math.round(v.total / v.n),
        samples: v.n,
      })),
      costByDay: [...byDay.entries()]
        .map(([day, currencies]) => ({ day, currencies }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      costByAdapter: [...byAdapter.entries()].map(([adapterId, currencies]) => ({
        adapterId,
        currencies,
      })),
      rerollHist,
    });
  } catch (e) {
    return handleError(e);
  }
}
