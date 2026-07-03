'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { ApiAdapter } from '@/lib/types';

export interface TemplateOption {
  id: string;
  name: string;
  genre: string;
  description: string;
}

/**
 * 新建项目：可直接贴入剧本（≤10 万字），选一个 LLM 一键触发分镜拆解。
 * 分镜模型下拉 —— 从第一个环节起就「任意模型可切」；模板下拉 —— 爆款结构一键套用。
 */
export function NewProjectForm({
  storyboardAdapters,
  templates,
}: {
  storyboardAdapters: ApiAdapter[];
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [script, setScript] = useState('');
  const [adapterId, setAdapterId] = useState(storyboardAdapters[0]?.id ?? '');
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ project: { id: string } }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          script: script.trim() || undefined,
          storyboardAdapterId: adapterId || undefined,
          templateId: templateId || undefined,
        }),
      });
      router.push(`/projects/${res.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        ＋ 新建项目
      </button>
    );
  }

  return (
    <div className="card w-full max-w-2xl p-6">
      <h2 className="text-lg font-semibold text-white">新建短剧项目</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <input
          className="input"
          placeholder="项目名称，例如：重生之她掀了牌桌"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <textarea
          className="input h-40 resize-y font-mono text-xs"
          placeholder="（可选）粘贴剧本，最多 10 万字。提交后自动拆分镜；留空则先建空项目。"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          maxLength={100_000}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400">分镜拆解模型</label>
          <select className="input w-auto" value={adapterId} onChange={(e) => setAdapterId(e.target.value)}>
            {storyboardAdapters.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
                {a.mock ? '（mock）' : ''}
              </option>
            ))}
          </select>
          <label className="text-xs text-slate-400">结构模板</label>
          <select
            className="input w-auto"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            title={templates.find((t) => t.id === templateId)?.description ?? '爆款节拍结构，注入分镜提示词'}
          >
            <option value="">不套用模板</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={loading}>
            {loading ? '创建中…' : script.trim() ? '创建并拆分镜' : '创建'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
