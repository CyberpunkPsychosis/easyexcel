'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CAPABILITY_LABEL, formatCents } from '@/lib/types';

interface CostsResponse {
  groups: { capability: string | null; adapterId: string | null; currency: string; spentCents: number; jobs: number }[];
  totals: { currency: string; spentCents: number }[];
  totalSeconds: number;
  avgRollsPerStage: number;
}

/**
 * 成本仪表盘。展示口径（调研教训，必须区分）：
 * 「实际已发生成本」= 含所有重roll变体的真实流水；预估值只在生成前显示。
 */
export function CostsView({ projectId }: { projectId: string }) {
  const { data } = useQuery({
    queryKey: ['costs', projectId],
    queryFn: () => api<CostsResponse>(`/api/projects/${projectId}/costs`),
    refetchInterval: 5000,
  });

  if (!data) return <main className="p-6 text-slate-400">加载中…</main>;

  const minutes = data.totalSeconds / 60;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="flex items-center gap-3">
        <Link href={`/projects/${projectId}`} className="btn-ghost text-xs">
          ← 工作台
        </Link>
        <h1 className="text-lg font-semibold text-white">成本仪表盘</h1>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.totals.map((t) => (
          <div key={t.currency} className="card p-4">
            <div className="text-xs text-slate-500">实际总花费（{t.currency}）</div>
            <div className="mt-1 text-xl font-semibold text-white">{formatCents(t.spentCents, t.currency)}</div>
            <div className="mt-1 text-[10px] text-slate-600">含全部重roll变体</div>
          </div>
        ))}
        <div className="card p-4">
          <div className="text-xs text-slate-500">分镜总时长</div>
          <div className="mt-1 text-xl font-semibold text-white">{minutes.toFixed(1)} 分钟</div>
          {data.totals.map((t) => (
            <div key={t.currency} className="mt-1 text-[10px] text-slate-600">
              每分钟等效 {minutes > 0 ? formatCents(Math.round(t.spentCents / minutes), t.currency) : '—'}
            </div>
          ))}
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">平均重roll（每环节）</div>
          <div className="mt-1 text-xl font-semibold text-white">{data.avgRollsPerStage}</div>
          <div className="mt-1 text-[10px] text-slate-600">行业参考：熟手 ~3-5 次/镜</div>
        </div>
      </section>

      <section className="card mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 text-slate-500">
            <tr>
              <th className="p-2">环节</th>
              <th className="p-2">模型</th>
              <th className="p-2">生成次数</th>
              <th className="p-2">花费</th>
            </tr>
          </thead>
          <tbody>
            {data.groups.map((g, i) => (
              <tr key={i} className="border-b border-slate-800/60">
                <td className="p-2 text-slate-300">{CAPABILITY_LABEL[g.capability ?? ''] ?? g.capability}</td>
                <td className="p-2 font-mono text-slate-400">{g.adapterId}</td>
                <td className="p-2 text-slate-400">{g.jobs}</td>
                <td className="p-2 text-white">{formatCents(g.spentCents, g.currency)}</td>
              </tr>
            ))}
            {data.groups.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  暂无消耗记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
