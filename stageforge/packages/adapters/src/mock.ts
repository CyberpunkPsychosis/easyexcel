import {
  computeCostCents,
  silentWav,
  svgPlaceholder,
  type AdapterCaps,
  type AssetOutput,
  type Capability,
  type CostModel,
  type Credits,
  type I2VInput,
  type LipsyncInput,
  type ModelAdapter,
  type MusicInput,
  type RunContext,
  type T2IInput,
  type TTSInput,
  type Usage,
} from '@stageforge/core';

/**
 * mock adapter 工厂：无 API key 的模型统一走这里，保证全流程可 demo。
 * submit 阶段直接产出结果挂在 handle.data 上，poll 立即 succeeded ——
 * 与真实异步适配器共用同一个 submit→poll 生命周期，流水线代码零分支。
 */
export interface AdapterMeta {
  id: string;
  capability: Capability;
  displayName: string;
  provider: string;
  region: 'cn' | 'global';
  caps: AdapterCaps;
  cost: CostModel;
  notes?: string;
  confidence?: 'verified' | 'uncertain';
}

interface MockResult<O> {
  output: O;
  usage?: Usage;
}

export function defineMockAdapter<I, O>(
  meta: AdapterMeta,
  estimateUsage: (input: I) => Usage,
  produce: (input: I, ctx: RunContext) => Promise<MockResult<O>>,
): ModelAdapter<I, O> {
  return {
    ...meta,
    mock: true,
    estimateCost(input: I): Credits {
      return computeCostCents(meta.cost, estimateUsage(input));
    },
    async submit(input: I, ctx: RunContext) {
      const result = await produce(input, ctx);
      return { externalId: `mock:${meta.id}:${ctx.jobId}`, data: result };
    },
    async poll(handle) {
      const result = handle.data as MockResult<O>;
      return { state: 'succeeded', output: result.output, usage: result.usage };
    },
  };
}

/** 视频类 mock：ffmpeg 渲染占位 mp4，无 ffmpeg 时降级 SVG 占位 */
export function defineMockVideoAdapter(
  meta: AdapterMeta & { hue: number },
): ModelAdapter<I2VInput, AssetOutput> {
  const { hue, ...rest } = meta;
  return defineMockAdapter<I2VInput, AssetOutput>(
    rest,
    (input) => ({ seconds: clampDuration(input.durationSec, meta.caps.maxDurationSec) }),
    async (input, ctx) => {
      const durationSec = clampDuration(input.durationSec, meta.caps.maxDurationSec);
      const refNote = input.characterRefs?.length
        ? `锁角色: ${input.characterRefs.map((r) => r.name).join('/')}`
        : '';
      const rendered = await ctx.renderPlaceholderVideo({
        durationSec,
        title: input.prompt.slice(0, 30),
        subtitle: `${meta.displayName} · ${input.resolution} ${refNote}`,
        hue,
      });
      if (rendered) {
        return { output: { asset: rendered }, usage: { seconds: durationSec } };
      }
      // 无 ffmpeg：SVG 占位（kind 仍为 video，meta 标记 placeholder，合成时会被跳过并提示）
      const asset = await ctx.saveAsset({
        kind: 'video',
        data: svgPlaceholder({
          title: input.prompt.slice(0, 40),
          subtitle: `视频占位（无 ffmpeg）· ${durationSec}s ${refNote}`,
          badge: meta.id,
          hue,
        }),
        contentType: 'image/svg+xml',
        ext: 'svg',
        meta: { placeholder: 'no-ffmpeg', durationSec },
      });
      return { output: { asset }, usage: { seconds: durationSec } };
    },
  );
}

/** 图像类 mock：SVG 占位图 */
export function defineMockImageAdapter(
  meta: AdapterMeta & { hue: number },
): ModelAdapter<T2IInput, AssetOutput> {
  const { hue, ...rest } = meta;
  return defineMockAdapter<T2IInput, AssetOutput>(
    rest,
    () => ({ images: 1 }),
    async (input, ctx) => {
      const refNote = input.characterRefs?.length
        ? `@${input.characterRefs.map((r) => r.name).join(' @')}`
        : '';
      const asset = await ctx.saveAsset({
        kind: 'image',
        data: svgPlaceholder({
          title: input.prompt.slice(0, 48),
          subtitle: `${meta.displayName} ${refNote}`,
          badge: meta.id,
          hue,
        }),
        contentType: 'image/svg+xml',
        ext: 'svg',
      });
      return { output: { asset }, usage: { images: 1 } };
    },
  );
}

/** TTS 类 mock：静音 WAV（时长按台词长度估） */
export function defineMockTtsAdapter(meta: AdapterMeta): ModelAdapter<TTSInput, AssetOutput> {
  return defineMockAdapter<TTSInput, AssetOutput>(
    meta,
    (input) => ({ chars: input.text.length }),
    async (input, ctx) => {
      const seconds = Math.min(8, Math.max(1, input.text.length / 6));
      const asset = await ctx.saveAsset({
        kind: 'audio',
        data: silentWav(seconds),
        contentType: 'audio/wav',
        ext: 'wav',
        meta: { mock: true, text: input.text.slice(0, 100), seconds },
      });
      return { output: { asset }, usage: { chars: input.text.length } };
    },
  );
}

/** 口型对齐类 mock：直接透传输入视频资产（真实实现会重渲染口型） */
export function defineMockLipsyncAdapter(meta: AdapterMeta): ModelAdapter<LipsyncInput, AssetOutput> {
  return defineMockAdapter<LipsyncInput, AssetOutput>(
    meta,
    () => ({ seconds: 5 }),
    async (input, ctx) => {
      ctx.log(`${meta.id}: mock 透传视频资产 ${input.videoAssetId}（真实实现将重渲染口型）`);
      return {
        output: {
          asset: { assetId: input.videoAssetId, storageKey: '', contentType: 'video/mp4' },
        },
        usage: { seconds: 5 },
      };
    },
  );
}

/** 配乐/音效类 mock：静音 WAV */
export function defineMockMusicAdapter(meta: AdapterMeta): ModelAdapter<MusicInput, AssetOutput> {
  return defineMockAdapter<MusicInput, AssetOutput>(
    meta,
    (input) => ({ seconds: input.durationSec }),
    async (input, ctx) => {
      const asset = await ctx.saveAsset({
        kind: 'audio',
        data: silentWav(Math.min(30, input.durationSec)),
        contentType: 'audio/wav',
        ext: 'wav',
        meta: { mock: true, prompt: input.prompt.slice(0, 80) },
      });
      return { output: { asset }, usage: { seconds: input.durationSec } };
    },
  );
}

export function clampDuration(requested: number, max?: number): number {
  const upper = max ?? 15;
  return Math.max(1, Math.min(requested || 5, upper));
}
