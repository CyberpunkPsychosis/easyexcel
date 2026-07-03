'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CAPABILITY_LABEL,
  SHOT_STAGES,
  formatCostModel,
  type ApiAdapter,
  type ApiModelConfig,
  type ApiShot,
} from '@/lib/types';

function CapsBadges({ adapter }: { adapter: ApiAdapter }) {
  const c = adapter.caps;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {c.maxDurationSec != null && (
        <span className="badge bg-slate-800 text-slate-300">≤{c.maxDurationSec}s/段</span>
      )}
      {c.nativeAudio && <span className="badge bg-emerald-900/60 text-emerald-300">原生音频</span>}
      {c.supportsReferenceImage && <span className="badge bg-blue-900/60 text-blue-300">角色参考</span>}
      {c.supportsMultiShot && <span className="badge bg-purple-900/60 text-purple-300">多镜连续</span>}
      <span className="badge bg-slate-800 text-slate-400">{formatCostModel(adapter.cost)}</span>
      <span className="badge bg-slate-800 text-slate-500">{adapter.region === 'cn' ? '国内' : '海外'}</span>
      {adapter.mock && <span className="badge bg-amber-900/60 text-amber-300">mock</span>}
      {adapter.confidence === 'uncertain' && (
        <span className="badge bg-slate-800 text-slate-500" title="该模型参数/价格来源单一，接入时校准">
          存疑
        </span>
      )}
    </div>
  );
}

/**
 * Stage Rail（环节导轨）—— 产品的记忆点。
 * 每个环节一行、一个模型下拉；下拉展示能力徽标（时长上限/原生音频/单价/地区）。
 * 「默认」= 跟随项目 ModelConfig；选择具体模型 = 单镜覆盖（写 ShotStage.adapterId）。
 * A/B 下拉 = 用另一个模型对同一镜头再生成一个变体，并排选优。
 */
export function StageRail({
  projectId,
  shot,
  adapters,
  modelConfigs,
}: {
  projectId: string;
  shot: ApiShot;
  adapters: ApiAdapter[];
  modelConfigs: ApiModelConfig[];
}) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['jobs', projectId] });
  };

  const setStage = useMutation({
    mutationFn: (p: { capability: string; adapterId: string | null }) =>
      api(`/api/shots/${shot.id}/stage`, { method: 'PATCH', body: JSON.stringify(p) }),
    onSuccess: invalidate,
  });

  const generate = useMutation({
    mutationFn: (p: { capability: string; adapterId?: string }) =>
      api(`/api/shots/${shot.id}/generate`, { method: 'POST', body: JSON.stringify(p) }),
    onSuccess: (_d, p) => {
      setErrors((e) => ({ ...e, [p.capability]: '' }));
      invalidate();
    },
    onError: (e, p) => setErrors((prev) => ({ ...prev, [p.capability]: e.message })),
  });

  return (
    <div className="space-y-3">
      {SHOT_STAGES.map((capability) => {
        const options = adapters.filter((a) => a.capability === capability);
        const override = shot.stages.find((s) => s.capability === capability)?.adapterId ?? null;
        const projectDefault = modelConfigs.find((m) => m.capability === capability)?.adapterId;
        const effectiveId = override ?? projectDefault ?? options[0]?.id;
        const effective = options.find((a) => a.id === effectiveId);
        const variantCount = shot.variants.filter((v) => v.capability === capability).length;
        const abOptions = options.filter((a) => a.id !== effectiveId);

        return (
          <div key={capability} className="card p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{CAPABILITY_LABEL[capability]}</span>
              <span className="text-[10px] text-slate-500">{variantCount} 变体</span>
            </div>

            <select
              className="input mt-2"
              value={override ?? ''}
              onChange={(e) =>
                setStage.mutate({ capability, adapterId: e.target.value === '' ? null : e.target.value })
              }
            >
              <option value="">
                默认 · {options.find((a) => a.id === projectDefault)?.displayName ?? projectDefault ?? '—'}
              </option>
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>

            {effective && (
              <>
                <CapsBadges adapter={effective} />
                {effective.notes && (
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">{effective.notes}</p>
                )}
              </>
            )}

            <div className="mt-2 flex items-center gap-2">
              <button
                className="btn-primary flex-1 text-xs"
                disabled={generate.isPending}
                onClick={() => generate.mutate({ capability })}
              >
                {variantCount > 0 ? '重 roll' : '生成'}
              </button>
              {abOptions.length > 0 && (
                <select
                  className="input w-28 text-xs"
                  value=""
                  title="A/B 对比：用另一个模型对同一镜头再生成一个变体"
                  onChange={(e) => {
                    if (e.target.value) generate.mutate({ capability, adapterId: e.target.value });
                  }}
                >
                  <option value="">A/B 对比…</option>
                  {abOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      vs {a.displayName}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {errors[capability] && <p className="mt-1 text-xs text-red-400">{errors[capability]}</p>}
          </div>
        );
      })}
      <p className="text-[10px] leading-4 text-slate-600">
        提示：成本口径 = 单次生成价 × 重roll次数。行业单次成功率常不足
        40%，预算请按「预计总成本（含重roll）」估。
      </p>
    </div>
  );
}
