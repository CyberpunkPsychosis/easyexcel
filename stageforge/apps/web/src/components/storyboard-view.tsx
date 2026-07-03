'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiAdapter, ApiProject } from '@/lib/types';

function EditableCell({
  value,
  onSave,
  mono,
}: {
  value: string;
  onSave: (v: string) => void;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <textarea
      className={`h-16 w-full resize-none rounded border border-transparent bg-transparent p-1 text-xs text-slate-300 hover:border-slate-700 focus:border-blue-600 focus:outline-none ${mono ? 'font-mono' : ''}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
    />
  );
}

/** 分镜表视图：Excel 式网格，行内编辑，粘贴剧本生成新分镜 */
export function StoryboardView({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<{ project: ApiProject }>(`/api/projects/${projectId}`),
  });
  const { data: registryData } = useQuery({
    queryKey: ['registry'],
    queryFn: () => api<{ adapters: ApiAdapter[] }>('/api/registry'),
    staleTime: 60_000,
  });

  const [script, setScript] = useState('');
  const [adapterId, setAdapterId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const storyboardAdapters = (registryData?.adapters ?? []).filter(
    (a) => a.capability === 'text.storyboard',
  );

  const patchShot = useMutation({
    mutationFn: (p: { shotId: string; data: Record<string, string> }) =>
      api(`/api/shots/${p.shotId}`, { method: 'PATCH', body: JSON.stringify(p.data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const generate = useMutation({
    mutationFn: () =>
      api(`/api/projects/${projectId}/storyboard`, {
        method: 'POST',
        body: JSON.stringify({ script, adapterId: adapterId || undefined }),
      }),
    onSuccess: () => {
      setMessage('分镜任务已提交，完成后自动出现在下方与工作台（几秒到几分钟，取决于剧本长度与模型）');
      setScript('');
    },
    onError: (e) => setMessage(e.message),
  });

  const project = data?.project;
  if (!project) return <main className="p-6 text-slate-400">加载中…</main>;

  const rows = project.episodes.flatMap((ep) =>
    ep.scenes.flatMap((scene) =>
      scene.shots.map((shot) => ({ ep, scene, shot })),
    ),
  );

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="flex items-center gap-3">
        <Link href={`/projects/${projectId}`} className="btn-ghost text-xs">
          ← 工作台
        </Link>
        <h1 className="text-lg font-semibold text-white">{project.name} · 分镜表</h1>
      </header>

      <section className="card mt-4 p-4">
        <h2 className="text-sm font-medium text-white">粘贴剧本 → 生成分镜（追加到现有集后）</h2>
        <textarea
          className="input mt-2 h-28 font-mono text-xs"
          placeholder="粘贴剧本，≤10 万字…"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          maxLength={100_000}
        />
        <div className="mt-2 flex items-center gap-3">
          <select className="input w-56" value={adapterId} onChange={(e) => setAdapterId(e.target.value)}>
            <option value="">默认分镜模型</option>
            {storyboardAdapters.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
                {a.mock ? '（mock）' : ''}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={script.trim().length < 10 || generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? '提交中…' : '生成分镜'}
          </button>
          {message && <span className="text-xs text-slate-400">{message}</span>}
        </div>
      </section>

      <section className="card mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 text-slate-500">
            <tr>
              <th className="p-2">集/场/镜</th>
              <th className="p-2 w-52">台词</th>
              <th className="p-2">画面提示词</th>
              <th className="p-2">景别</th>
              <th className="p-2">情绪</th>
              <th className="p-2">时长</th>
              <th className="p-2">变体</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ep, scene, shot }) => (
              <tr key={shot.id} className="border-b border-slate-800/60 align-top hover:bg-ink-900/60">
                <td className="p-2 text-slate-500">
                  {ep.title}
                  <br />
                  {scene.title} · #{shot.index + 1}
                </td>
                <td className="p-2">
                  <EditableCell
                    value={shot.dialogue}
                    onSave={(v) => patchShot.mutate({ shotId: shot.id, data: { dialogue: v } })}
                  />
                </td>
                <td className="p-2">
                  <EditableCell
                    mono
                    value={shot.visualPrompt}
                    onSave={(v) => patchShot.mutate({ shotId: shot.id, data: { visualPrompt: v } })}
                  />
                </td>
                <td className="p-2 text-slate-400">{shot.shotType}</td>
                <td className="p-2 text-slate-400">{shot.emotion}</td>
                <td className="p-2 text-slate-400">{shot.durationSec}s</td>
                <td className="p-2 text-slate-400">{shot.variants.length}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  暂无分镜，粘贴剧本生成
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
