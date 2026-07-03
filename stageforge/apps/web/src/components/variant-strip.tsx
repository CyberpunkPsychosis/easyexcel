'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CAPABILITY_LABEL, type ApiVariant } from '@/lib/types';

function VariantPreview({ variant, large }: { variant: ApiVariant; large?: boolean }) {
  const url = `/api/assets/${variant.assetId}`;
  const cls = large ? 'h-full w-full object-contain' : 'h-24 w-14 object-cover';
  if (variant.asset.contentType.startsWith('video/')) {
    return <video src={url} className={cls} controls={large} muted playsInline />;
  }
  if (variant.asset.contentType.startsWith('audio/')) {
    return (
      <div className={`flex items-center justify-center bg-ink-800 ${large ? 'h-full w-full' : 'h-24 w-14'}`}>
        {large ? <audio src={url} controls className="w-4/5" /> : <span className="text-lg">🔊</span>}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={cls} />;
}

/** 变体带：一次生成一个变体，成本累加，点击选优（selected 用于成片合成） */
export function VariantStrip({
  projectId,
  capability,
  variants,
}: {
  projectId: string;
  capability: string;
  variants: ApiVariant[];
}) {
  const queryClient = useQueryClient();
  const select = useMutation({
    mutationFn: (variantId: string) => api(`/api/variants/${variantId}/select`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const list = variants.filter((v) => v.capability === capability);
  if (list.length === 0) return null;

  return (
    <div>
      <div className="mb-1 text-xs text-slate-500">
        {CAPABILITY_LABEL[capability] ?? capability} · {list.length} 个变体（重roll累计计费）
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {list.map((v) => {
          const consistency = v.asset.meta?.consistency;
          return (
            <button
              key={v.id}
              onClick={() => select.mutate(v.id)}
              title={
                (v.selected ? '已选定（用于成片）' : '点击选定此变体') +
                (consistency ? `\n一致性 ${consistency.score}分：${consistency.notes}` : '')
              }
              className={`relative shrink-0 overflow-hidden rounded-lg border-2 transition ${
                v.selected ? 'border-blue-500 shadow shadow-blue-500/30' : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <VariantPreview variant={v} />
              {consistency && (
                <span
                  className={`absolute bottom-0.5 right-0.5 rounded px-1 text-[9px] font-bold ${
                    consistency.score >= 80 ? 'bg-emerald-600/90 text-white' : 'bg-red-600/90 text-white'
                  }`}
                >
                  {consistency.score}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { VariantPreview };
