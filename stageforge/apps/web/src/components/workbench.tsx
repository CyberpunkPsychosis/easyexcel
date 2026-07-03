'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkbenchStore } from '@/lib/store';
import { StageRail } from '@/components/stage-rail';
import { VariantPreview, VariantStrip } from '@/components/variant-strip';
import {
  CAPABILITY_LABEL,
  formatCents,
  type ApiAdapter,
  type ApiEpisode,
  type ApiJob,
  type ApiProject,
  type ApiShot,
} from '@/lib/types';

function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<{ project: ApiProject }>(`/api/projects/${projectId}`),
  });
}

function useRegistry() {
  return useQuery({
    queryKey: ['registry'],
    queryFn: () => api<{ adapters: ApiAdapter[] }>('/api/registry'),
    staleTime: 60_000,
  });
}

/** 任务轮询：有任务收敛（running→终态）时刷新项目树 */
function useJobs(projectId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['jobs', projectId],
    queryFn: () => api<{ jobs: ApiJob[] }>(`/api/projects/${projectId}/jobs`),
    refetchInterval: 2500,
  });
  const prevActive = useRef<Set<string>>(new Set());
  useEffect(() => {
    const jobs = query.data?.jobs ?? [];
    const active = new Set(jobs.filter((j) => j.status === 'queued' || j.status === 'running').map((j) => j.id));
    const finished = [...prevActive.current].some((id) => !active.has(id));
    if (finished) {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }
    prevActive.current = active;
  }, [query.data, projectId, queryClient]);
  return query;
}

function ShotEditor({ projectId, shot }: { projectId: string; shot: ApiShot }) {
  const queryClient = useQueryClient();
  const [dialogue, setDialogue] = useState(shot.dialogue);
  const [visualPrompt, setVisualPrompt] = useState(shot.visualPrompt);
  useEffect(() => {
    setDialogue(shot.dialogue);
    setVisualPrompt(shot.visualPrompt);
  }, [shot.id, shot.dialogue, shot.visualPrompt]);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/shots/${shot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ dialogue, visualPrompt }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const dirty = dialogue !== shot.dialogue || visualPrompt !== shot.visualPrompt;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-slate-400">台词 / 旁白</label>
        <textarea className="input h-16 resize-y" value={dialogue} onChange={(e) => setDialogue(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">画面提示词（visual prompt）</label>
        <textarea
          className="input h-24 resize-y font-mono text-xs"
          value={visualPrompt}
          onChange={(e) => setVisualPrompt(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>{shot.shotType}</span>
        <span>{shot.emotion}</span>
        <span>{shot.cameraMove}</span>
        <span>{shot.durationSec}s</span>
        {dirty && (
          <button className="btn-primary ml-auto text-xs" disabled={save.isPending} onClick={() => save.mutate()}>
            保存修改
          </button>
        )}
      </div>
    </div>
  );
}

function EpisodeTree({
  projectId,
  episodes,
  selectedShotId,
  onSelect,
}: {
  projectId: string;
  episodes: ApiEpisode[];
  selectedShotId: string | null;
  onSelect: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const compose = useMutation({
    mutationFn: (episodeId: string) => api(`/api/episodes/${episodeId}/compose`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs', projectId] }),
  });

  return (
    <nav className="space-y-4">
      {episodes.map((ep) => (
        <div key={ep.id}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white">{ep.title}</span>
            <div className="flex items-center gap-1">
              {ep.finalAssetId && (
                <a
                  className="badge bg-emerald-900/60 text-emerald-300"
                  href={`/api/assets/${ep.finalAssetId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  成片 ▶
                </a>
              )}
              <button
                className="btn-ghost px-2 py-0.5 text-[10px]"
                disabled={compose.isPending || ep.status === 'rendering'}
                onClick={() => compose.mutate(ep.id)}
                title="拼接每镜选中的视频变体，烧字幕，输出 9:16 成片"
              >
                {ep.status === 'rendering' ? '合成中…' : '合成'}
              </button>
            </div>
          </div>
          {compose.isError && <p className="text-[10px] text-red-400">{compose.error.message}</p>}
          {ep.scenes.map((scene) => (
            <div key={scene.id} className="mt-2">
              <div className="text-xs text-slate-500">
                {scene.title}
                {scene.location ? ` · ${scene.location}` : ''}
              </div>
              <div className="mt-1 space-y-1">
                {scene.shots.map((shot) => {
                  const hasVideo = shot.variants.some(
                    (v) => v.selected && v.capability.startsWith('video.') && v.asset.contentType.startsWith('video/'),
                  );
                  return (
                    <button
                      key={shot.id}
                      onClick={() => onSelect(shot.id)}
                      className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs transition ${
                        selectedShotId === shot.id
                          ? 'bg-blue-600/20 text-blue-200 ring-1 ring-blue-600'
                          : 'text-slate-400 hover:bg-ink-800'
                      }`}
                    >
                      <span className="mr-1 text-slate-600">#{shot.index + 1}</span>
                      {shot.dialogue ? shot.dialogue.slice(0, 18) : shot.visualPrompt.slice(0, 18)}
                      {hasVideo && <span className="ml-1 text-emerald-400">●</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function Workbench({ projectId }: { projectId: string }) {
  const { data: projectData, isLoading } = useProject(projectId);
  const { data: registryData } = useRegistry();
  const { data: jobsData } = useJobs(projectId);
  const { selectedShotId, setSelectedShot } = useWorkbenchStore();

  const project = projectData?.project;
  const adapters = registryData?.adapters ?? [];
  const jobs = jobsData?.jobs ?? [];
  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'running');
  const failedJobs = jobs.filter((j) => j.status === 'failed').slice(0, 3);

  const allShots = useMemo(
    () => project?.episodes.flatMap((e) => e.scenes.flatMap((s) => s.shots)) ?? [],
    [project],
  );
  const selectedShot = allShots.find((s) => s.id === selectedShotId) ?? allShots[0] ?? null;

  useEffect(() => {
    if (!selectedShotId && allShots[0]) setSelectedShot(allShots[0].id);
  }, [selectedShotId, allShots, setSelectedShot]);

  if (isLoading || !project) {
    return <main className="flex min-h-screen items-center justify-center text-slate-400">加载中…</main>;
  }

  const mainPreview =
    selectedShot?.variants.find((v) => v.selected && v.capability.startsWith('video.')) ??
    selectedShot?.variants.find((v) => v.selected && v.capability === 'image.t2i') ??
    null;

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-slate-800 px-4 py-2.5">
        <Link href="/" className="text-sm font-bold text-white">
          Stage<span className="text-blue-400">Forge</span>
        </Link>
        <span className="text-sm text-slate-300">{project.name}</span>
        <nav className="ml-4 flex gap-2 text-xs">
          <span className="badge bg-blue-900/50 text-blue-300">工作台</span>
          <Link className="badge bg-slate-800 text-slate-400 hover:text-white" href={`/projects/${projectId}/storyboard`}>
            分镜表
          </Link>
          <Link className="badge bg-slate-800 text-slate-400 hover:text-white" href={`/projects/${projectId}/costs`}>
            成本
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs">
          {activeJobs.length > 0 && (
            <span className="flex items-center gap-1.5 text-blue-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
              {activeJobs.length} 个任务进行中（{activeJobs.map((j) => CAPABILITY_LABEL[j.capability] ?? j.capability).join('、')}）
            </span>
          )}
          {failedJobs.length > 0 && (
            <span className="text-red-400" title={failedJobs.map((j) => `${j.adapterId}: ${j.error}`).join('\n')}>
              {failedJobs.length} 个任务失败（悬停看原因）
            </span>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 左：集/场/镜 树 */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-800 p-3">
          <EpisodeTree
            projectId={projectId}
            episodes={project.episodes}
            selectedShotId={selectedShot?.id ?? null}
            onSelect={setSelectedShot}
          />
          {project.episodes.length === 0 && (
            <p className="text-xs text-slate-500">
              还没有分镜。去「分镜表」页粘贴剧本生成，或新建项目时直接带剧本。
            </p>
          )}
        </aside>

        {/* 中：镜头画布 */}
        <section className="min-w-0 flex-1 overflow-y-auto p-4">
          {selectedShot ? (
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="flex justify-center">
                <div className="card flex aspect-[9/16] h-[420px] items-center justify-center overflow-hidden">
                  {mainPreview ? (
                    <VariantPreview variant={mainPreview} large />
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-500">
                      尚未生成
                      <br />
                      在右侧 Stage Rail 依次生成 关键帧 → 视频
                    </div>
                  )}
                </div>
              </div>
              <ShotEditor projectId={projectId} shot={selectedShot} />
              <div className="space-y-3">
                {['image.t2i', 'video.i2v', 'video.t2v', 'audio.tts', 'audio.lipsync'].map((cap) => (
                  <VariantStrip key={cap} projectId={projectId} capability={cap} variants={selectedShot.variants} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">左侧选择一个镜头开始</p>
          )}
        </section>

        {/* 右：Stage Rail —— 每个环节一个模型下拉，任意切换 */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-800 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Stage Rail · 环节 × 模型
          </h3>
          {selectedShot && (
            <StageRail
              projectId={projectId}
              shot={selectedShot}
              adapters={adapters}
              modelConfigs={project.modelConfigs}
            />
          )}
          {jobs.length > 0 && (
            <div className="mt-4 border-t border-slate-800 pt-3">
              <h4 className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">最近任务</h4>
              <ul className="space-y-1 text-[11px] text-slate-500">
                {jobs.slice(0, 8).map((j) => (
                  <li key={j.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {CAPABILITY_LABEL[j.capability] ?? j.capability} · {j.adapterId}
                    </span>
                    <span
                      className={
                        j.status === 'succeeded'
                          ? 'text-emerald-400'
                          : j.status === 'failed'
                            ? 'text-red-400'
                            : 'text-blue-300'
                      }
                    >
                      {j.status === 'succeeded'
                        ? formatCents(j.actualCostCents, j.currency)
                        : j.status === 'failed'
                          ? '失败'
                          : '进行中'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
