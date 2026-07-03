'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import type { ApiProject } from '@/lib/types';

interface MemberRow {
  id: string;
  role: string;
  user: { id: string; email: string; name: string | null };
}

interface ComplianceReport {
  status: 'passed' | 'blocked';
  checks: {
    registration: { ok: boolean; note: string };
    watermark: { ok: boolean; note: string };
    content: { ok: boolean; findings: { severity: string; quote: string; reason: string }[]; mock: boolean };
  };
}

interface ProjectWithSettings extends ApiProject {
  ownerId: string;
  registrationNo: string | null;
  episodes: (ApiProject['episodes'][number] & {
    complianceStatus: string;
    complianceReport: ComplianceReport | Record<string, never>;
    watermark: boolean;
  })[];
}

function MembersSection({ projectId, ownerId }: { projectId: string; ownerId: string }) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isOwner = session?.user?.id === ownerId;
  const { data } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () =>
      api<{ owner: { email: string; name: string | null }; members: MemberRow[] }>(
        `/api/projects/${projectId}/members`,
      ),
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['members', projectId] });

  const invite = useMutation({
    mutationFn: () =>
      api(`/api/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ email, role }) }),
    onSuccess: () => {
      setEmail('');
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (memberId: string) =>
      api(`/api/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  return (
    <section className="card mt-4 p-4">
      <h2 className="font-display text-base font-semibold tracking-wide text-white">团队成员</h2>
      <ul className="mt-3 space-y-1.5 text-xs">
        <li className="flex items-center justify-between">
          <span className="text-slate-300">{data?.owner?.email}</span>
          <span className="badge bg-blue-900/60 text-blue-300">所有者</span>
        </li>
        {(data?.members ?? []).map((m) => (
          <li key={m.id} className="flex items-center justify-between">
            <span className="text-slate-300">{m.user.email}</span>
            <span className="flex items-center gap-2">
              <span className="badge bg-slate-800 text-slate-400">
                {m.role === 'editor' ? '可编辑' : '只读'}
              </span>
              {(isOwner || m.user.id === session?.user?.id) && (
                <button className="text-[10px] text-slate-600 hover:text-red-400" onClick={() => remove.mutate(m.id)}>
                  {m.user.id === session?.user?.id ? '退出' : '移除'}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {isOwner && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="input w-64"
            placeholder="成员邮箱（须已注册）"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select className="input w-24" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="editor">可编辑</option>
            <option value="viewer">只读</option>
          </select>
          <button className="btn-primary text-xs" disabled={!email || invite.isPending} onClick={() => invite.mutate()}>
            邀请
          </button>
          {invite.isError && <span className="text-xs text-red-400">{invite.error.message}</span>}
        </div>
      )}
    </section>
  );
}

/** 设置页（M4）：备案信息 + 每集合规卡点操作台 + 团队成员 */
export function SettingsView({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<{ project: ProjectWithSettings }>(`/api/projects/${projectId}`),
  });
  const project = data?.project;
  const [regNo, setRegNo] = useState<string | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['project', projectId] });

  const saveReg = useMutation({
    mutationFn: (value: string) =>
      api(`/api/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ registrationNo: value || null }),
      }),
    onSuccess: invalidate,
  });
  const check = useMutation({
    mutationFn: (p: { episodeId: string; watermark?: boolean }) =>
      api(`/api/episodes/${p.episodeId}/compliance-check`, {
        method: 'POST',
        body: JSON.stringify(p.watermark === undefined ? {} : { watermark: p.watermark }),
      }),
    onSuccess: invalidate,
  });

  if (!project) return <main className="p-6 text-slate-400">加载中…</main>;
  const regValue = regNo ?? project.registrationNo ?? '';

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="flex items-center gap-3">
        <Link href={`/projects/${projectId}`} className="btn-ghost text-xs">
          ← 工作台
        </Link>
        <h1 className="display-title text-xl">{project.name} · 设置</h1>
      </header>

      <section className="card mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-wide text-white">备案信息</h2>
        <p className="mt-1 text-xs text-slate-500">
          2026-04 起未备案 AI 短剧一律下架。备案号会随 AI 标识水印烧进成片角标，也是合规卡点的校验项。
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            className="input w-80"
            placeholder="例：粤网剧审字(2026)第000000号"
            value={regValue}
            onChange={(e) => setRegNo(e.target.value)}
          />
          <button
            className="btn-primary text-xs"
            disabled={saveReg.isPending || regValue === (project.registrationNo ?? '')}
            onClick={() => saveReg.mutate(regValue)}
          >
            保存
          </button>
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="font-display text-base font-semibold tracking-wide text-white">剧集合规卡点</h2>
        <p className="mt-1 text-xs text-slate-500">
          合成/导出前强制检查：备案号、AI 标识水印、台词内容预审（LLM）。blocked 状态禁止出片。
        </p>
        <div className="mt-3 space-y-3">
          {project.episodes.map((ep) => {
            const report = ep.complianceReport as ComplianceReport;
            return (
              <div key={ep.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-white">{ep.title}</span>
                  <span
                    className={`badge ${
                      ep.complianceStatus === 'passed'
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : ep.complianceStatus === 'blocked'
                          ? 'bg-red-900/60 text-red-300'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {ep.complianceStatus === 'passed' ? '已通过' : ep.complianceStatus === 'blocked' ? '已拦截' : '未检查'}
                  </span>
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={ep.watermark}
                      onChange={(e) => check.mutate({ episodeId: ep.id, watermark: e.target.checked })}
                    />
                    AI 标识水印
                  </label>
                  <button
                    className="btn-ghost text-xs"
                    disabled={check.isPending}
                    onClick={() => check.mutate({ episodeId: ep.id })}
                  >
                    {check.isPending ? '检查中…' : '合规检查'}
                  </button>
                </div>
                {report?.checks && (
                  <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
                    <li className={report.checks.registration.ok ? 'text-emerald-500' : 'text-amber-400'}>
                      {report.checks.registration.ok ? '✓' : '⚠'} {report.checks.registration.note}
                    </li>
                    <li className={report.checks.watermark.ok ? 'text-emerald-500' : 'text-amber-400'}>
                      {report.checks.watermark.ok ? '✓' : '⚠'} {report.checks.watermark.note}
                    </li>
                    <li className={report.checks.content.ok ? 'text-emerald-500' : 'text-red-400'}>
                      {report.checks.content.ok ? '✓ 内容预审通过' : '✗ 内容预审发现风险'}
                      {report.checks.content.mock ? '（mock：填 ANTHROPIC_API_KEY 启用真实审核）' : ''}
                    </li>
                    {report.checks.content.findings.map((f, i) => (
                      <li key={i} className={f.severity === 'block' ? 'text-red-400' : 'text-amber-400'}>
                        [{f.severity === 'block' ? '拦截' : '提醒'}] {f.reason}
                        {f.quote ? ` ——「${f.quote.slice(0, 30)}」` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {project.episodes.length === 0 && <p className="text-xs text-slate-500">暂无剧集</p>}
        </div>
      </section>

      <MembersSection projectId={projectId} ownerId={project.ownerId} />
    </main>
  );
}
