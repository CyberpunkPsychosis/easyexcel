'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiCharacter, ApiProject } from '@/lib/types';

interface ApiCharacterFull extends ApiCharacter {
  consistencyNote: string;
}

function CharacterCard({ projectId, character }: { projectId: string; character: ApiCharacterFull }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(character.consistencyNote);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['project', projectId] });

  const generateRef = useMutation({
    mutationFn: () =>
      api(`/api/characters/${character.id}/ref-image`, {
        method: 'POST',
        body: JSON.stringify({ mode: 'generate' }),
      }),
    onSuccess: invalidate,
  });

  const saveNote = useMutation({
    mutationFn: () =>
      api(`/api/characters/${character.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ consistencyNote: note }),
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => api(`/api/characters/${character.id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await api(`/api/characters/${character.id}/ref-image`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'upload', dataUrl }),
    });
    invalidate();
  }

  return (
    <div className="card p-4">
      <div className="flex gap-4">
        <div className="h-40 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-ink-800">
          {character.refAssetId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/assets/${character.refAssetId}`} alt={character.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-slate-500">无参考图</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">{character.name}</h3>
            <button
              className="text-[10px] text-slate-600 hover:text-red-400"
              onClick={() => {
                if (confirm(`删除角色「${character.name}」？`)) remove.mutate();
              }}
            >
              删除
            </button>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{character.description || '—'}</p>
          <label className="mt-2 block text-[10px] text-slate-500">
            一致性话术（注入所有支持参考图的模型）
          </label>
          <textarea
            className="input mt-1 h-14 resize-none text-xs"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== character.consistencyNote && saveNote.mutate()}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="btn-primary text-xs"
              disabled={generateRef.isPending}
              onClick={() => generateRef.mutate()}
              title="用 image.character 能力生成正面中性定妆照（模型可在 Stage Rail 逻辑同款注册表切换）"
            >
              {generateRef.isPending ? '生成中…' : character.refAssetId ? '重生成参考图' : '生成参考图'}
            </button>
            <label className="btn-ghost cursor-pointer text-xs">
              上传定妆照
              <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
            </label>
          </div>
          {generateRef.isError && <p className="mt-1 text-xs text-red-400">{generateRef.error.message}</p>}
        </div>
      </div>
    </div>
  );
}

/** 角色库：跨镜头一致性的锚 —— 参考图可移植到任一支持参考的视频/图像模型 */
export function CharactersView({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<{ project: ApiProject & { characters: ApiCharacterFull[] } }>(`/api/projects/${projectId}`),
    refetchInterval: 4000, // 参考图生成是异步任务，轮询等回写
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api(`/api/projects/${projectId}/characters`, {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      }),
    onSuccess: () => {
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  const project = data?.project;
  if (!project) return <main className="p-6 text-slate-400">加载中…</main>;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="flex items-center gap-3">
        <Link href={`/projects/${projectId}`} className="btn-ghost text-xs">
          ← 工作台
        </Link>
        <h1 className="text-lg font-semibold text-white">{project.name} · 角色库</h1>
      </header>

      <section className="card mt-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-40">
          <label className="mb-1 block text-xs text-slate-400">角色名</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：林晚" />
        </div>
        <div className="flex-[2] min-w-60">
          <label className="mb-1 block text-xs text-slate-400">人设描述（用于生成定妆照）</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：28岁，外柔内刚，职场逆袭女主"
          />
        </div>
        <button className="btn-primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          ＋ 新建角色
        </button>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {project.characters.map((c) => (
          <CharacterCard key={c.id} projectId={projectId} character={c as ApiCharacterFull} />
        ))}
        {project.characters.length === 0 && (
          <p className="text-sm text-slate-500">
            还没有角色。先建角色并生成/上传参考图，生成镜头时会自动 @引用并注入一致性话术（不跳脸的关键）。
          </p>
        )}
      </section>
    </main>
  );
}
