import type { ModelAdapter } from '@stageforge/core';

/**
 * 内置 ffmpeg 合成（render.compose）。
 * 说明：合成不走 submit/poll 适配器生命周期 —— worker 的 compose 队列原生处理
 * （拼接选中变体、烧字幕、混音、输出 9:16 成片）。此条目存在的意义是让
 * render.compose 能力在注册表/UI 中可见、可被未来的云端剪辑服务替换。
 */
export const internalFfmpeg: ModelAdapter<Record<string, never>, Record<string, never>> = {
  id: 'internal-ffmpeg',
  capability: 'render.compose',
  displayName: '内置合成（ffmpeg）',
  provider: 'StageForge',
  region: 'cn',
  caps: { aspectRatios: ['9:16'], async: true },
  cost: { unit: 'free', currency: 'CNY' },
  mock: false,
  notes: '拼接 + 烧字幕（默认开启：80% 观众静音观看）+ 9:16 转码',
  confidence: 'verified',
  estimateCost() {
    return { cents: 0, currency: 'CNY' };
  },
  async submit() {
    throw new Error('render.compose 由 worker 的 compose 队列原生处理，不经 adapter.submit');
  },
  async poll() {
    throw new Error('render.compose 由 worker 的 compose 队列原生处理，不经 adapter.poll');
  },
};
