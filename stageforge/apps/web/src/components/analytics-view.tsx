'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CAPABILITY_LABEL, formatCents } from '@/lib/types';

interface AnalyticsResponse {
  statusGroups: { capability: string; status: string; count: number }[];
  avgDurationMs: { capability: string; avgMs: number; samples: number }[];
  costByDay: { day: string; currencies: Record<string, number> }[];
  costByAdapter: { adapterId: string; currencies: Record<string, number> }[];
  rerollHist: { r1: number; r2: number; r3: number; r4plus: number };
}

function Bar({ ratio, color = 'bg-blue-500' }: { ratio: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-ink-800">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
    </div>
  );
}

/** 数据分析：生产侧指标 —— 把「抽卡税」和产能变成看得见的数字 */
export function AnalyticsView({ projectId }: { projectId: string }) {
  const { data } = useQuery({
    queryKey: ['analytics', projectId],
    queryFn: () => api<AnalyticsResponse>(`/api/projects/${projectId}/analytics`),
    refetchInterval: 8000,
  });
  if (!data) return <main className="p-6 text-slate-400">加载中…</main>;

  const capabilities = [...new Set(data.statusGroups.map((g) => g.capability))];
  const successRates = capabilities.map((cap) => {
    const rows = data.statusGroups.filter((g) => g.capability === cap);
    const total = rows.reduce((a, r) => a + r.count, 0);
    const ok = rows.filter((r) => r.status === 'succeeded').reduce((a, r) => a + r.count, 0);
    return { cap, total, ok, rate: total > 0 ? ok / total : 0 };
  });

  const rerollTotal =
    data.rerollHist.r1 + data.rerollHist.r2 + data.rerollHist.r3 + data.rerollHist.r4plus || 1;
  const dayMax = Math.max(
    1,
    ...data.costByDay.map((d) => Object.values(d.currencies).reduce((a, b) => a + b, 0)),
  );

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="flex items-center gap-3">
        <Link href={`/projects/${projectId}`} className="btn-ghost text-xs">
          ← 工作台
        </Link>
        <h1 className="display-title text-xl">数据分析</h1>
      </header>

      <section className="card mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-wide text-white">各环节任务成功率</h2>
        <div className="mt-3 space-y-2">
          {successRates.map((r) => (
            <div key={r.cap} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-xs">
              <span className="text-slate-400">{CAPABILITY_LABEL[r.cap] ?? r.cap}</span>
              <Bar ratio={r.rate} color={r.rate >= 0.8 ? 'bg-emerald-500' : 'bg-amber-500'} />
              <span className="text-slate-500">
                {r.ok}/{r.total}（{Math.round(r.rate * 100)}%）
              </span>
            </div>
          ))}
          {successRates.length === 0 && <p className="text-xs text-slate-500">暂无任务数据</p>}
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-wide text-white">各环节平均耗时</h2>
        <div className="mt-3 space-y-2">
          {data.avgDurationMs.map((r) => (
            <div key={r.capability} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{CAPABILITY_LABEL[r.capability] ?? r.capability}</span>
              <span className="text-slate-300">
                {(r.avgMs / 1000).toFixed(1)}s <span className="text-slate-600">（{r.samples} 次）</span>
              </span>
            </div>
          ))}
          {data.avgDurationMs.length === 0 && <p className="text-xs text-slate-500">暂无耗时数据</p>}
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-wide text-white">
          重roll分布 <span className="text-[10px] text-slate-500">（行业参考：单次成功率不足 40%）</span>
        </h2>
        <div className="mt-3 space-y-2 text-xs">
          {(
            [
              ['一次过', data.rerollHist.r1, 'bg-emerald-500'],
              ['2 次', data.rerollHist.r2, 'bg-blue-500'],
              ['3 次', data.rerollHist.r3, 'bg-amber-500'],
              ['4 次以上', data.rerollHist.r4plus, 'bg-red-500'],
            ] as const
          ).map(([label, n, color]) => (
            <div key={label} className="grid grid-cols-[6rem_1fr_4rem] items-center gap-3">
              <span className="text-slate-400">{label}</span>
              <Bar ratio={n / rerollTotal} color={color} />
              <span className="text-slate-500">{n} 个环节</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-wide text-white">成本日趋势（实际流水，含重roll）</h2>
        <div className="mt-3 space-y-2">
          {data.costByDay.map((d) => {
            const total = Object.values(d.currencies).reduce((a, b) => a + b, 0);
            return (
              <div key={d.day} className="grid grid-cols-[6rem_1fr_10rem] items-center gap-3 text-xs">
                <span className="text-slate-500">{d.day}</span>
                <Bar ratio={total / dayMax} />
                <span className="text-slate-400">
                  {Object.entries(d.currencies)
                    .map(([c, cents]) => formatCents(cents, c))
                    .join(' + ')}
                </span>
              </div>
            );
          })}
          {data.costByDay.length === 0 && <p className="text-xs text-slate-500">暂无消耗数据</p>}
        </div>
      </section>

      <section className="card mt-4 overflow-x-auto p-4">
        <h2 className="font-display text-base font-semibold tracking-wide text-white">模型用量占比（按花费）</h2>
        <table className="mt-2 w-full text-left text-xs">
          <tbody>
            {data.costByAdapter.map((r) => (
              <tr key={r.adapterId} className="border-b border-slate-800/60">
                <td className="p-1.5 font-mono text-slate-400">{r.adapterId}</td>
                <td className="p-1.5 text-white">
                  {Object.entries(r.currencies)
                    .map(([c, cents]) => formatCents(cents, c))
                    .join(' + ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
