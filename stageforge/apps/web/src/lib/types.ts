/**
 * 前端使用的 API JSON 视图类型。
 * 注意：客户端组件不 import @stageforge/core（其中含 node:fs 等服务端依赖），
 * 所以这里维护一份轻量镜像。
 */

export const SHOT_STAGES = ['image.t2i', 'video.i2v', 'audio.tts', 'audio.lipsync'] as const;

export const CAPABILITY_LABEL: Record<string, string> = {
  'text.script': '剧本',
  'text.storyboard': '分镜拆解',
  'text.translate': '翻译',
  'image.t2i': '关键帧',
  'image.character': '角色资产',
  'video.t2v': '文生视频',
  'video.i2v': '视频生成',
  'audio.tts': '配音',
  'audio.voiceclone': '声音克隆',
  'audio.lipsync': '口型对齐',
  'audio.music': '配乐',
  'audio.sfx': '音效',
  'render.compose': '成片合成',
};

export interface ApiAdapterCaps {
  maxDurationSec?: number;
  resolutions?: string[];
  aspectRatios?: string[];
  nativeAudio?: boolean;
  supportsReferenceImage?: boolean;
  supportsMultiShot?: boolean;
  async: boolean;
}

export type ApiCostModel =
  | { unit: 'per_second'; price: number; currency: string }
  | { unit: 'per_image'; price: number; currency: string }
  | { unit: 'per_1k_char'; price: number; currency: string }
  | { unit: 'per_1k_token'; input: number; output: number; currency: string }
  | { unit: 'free'; currency: string };

export interface ApiAdapter {
  id: string;
  capability: string;
  displayName: string;
  provider: string;
  region: 'cn' | 'global';
  caps: ApiAdapterCaps;
  cost: ApiCostModel;
  mock: boolean;
  notes?: string;
  confidence?: 'verified' | 'uncertain';
}

export interface ApiAsset {
  id: string;
  kind: string;
  contentType: string;
}

export interface ApiVariant {
  id: string;
  capability: string;
  assetId: string;
  jobId: string | null;
  selected: boolean;
  createdAt: string;
  asset: ApiAsset;
}

export interface ApiStage {
  id: string;
  capability: string;
  adapterId: string | null;
}

export interface ApiShot {
  id: string;
  index: number;
  dialogue: string;
  visualPrompt: string;
  shotType: string;
  emotion: string;
  cameraMove: string;
  durationSec: number;
  characterIds: string[];
  /** 出海译文 { lang: text } */
  translations: Record<string, string>;
  stages: ApiStage[];
  variants: ApiVariant[];
}

/** 出海目标语言（M2 先覆盖主流短剧出海市场） */
export const TARGET_LANGS: [string, string][] = [
  ['en', '英语'],
  ['ja', '日语'],
  ['ko', '韩语'],
  ['es', '西班牙语'],
  ['pt', '葡萄牙语'],
  ['id', '印尼语'],
  ['th', '泰语'],
];

export interface ApiScene {
  id: string;
  index: number;
  title: string;
  location: string;
  shots: ApiShot[];
}

export interface ApiEpisode {
  id: string;
  index: number;
  title: string;
  status: string;
  finalAssetId: string | null;
  musicAssetId: string | null;
  scenes: ApiScene[];
}

export interface ApiCharacter {
  id: string;
  name: string;
  description: string;
  refAssetId: string | null;
}

export interface ApiModelConfig {
  capability: string;
  adapterId: string;
}

export interface ApiProject {
  id: string;
  name: string;
  description: string | null;
  episodes: ApiEpisode[];
  characters: ApiCharacter[];
  modelConfigs: ApiModelConfig[];
}

export interface ApiJob {
  id: string;
  capability: string;
  adapterId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error: string | null;
  shotId: string | null;
  episodeId: string | null;
  estimatedCostCents: number;
  actualCostCents: number;
  currency: string;
  createdAt: string;
  finishedAt: string | null;
}

export function formatCents(cents: number, currency: string): string {
  const symbol = currency === 'CNY' ? '¥' : '$';
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export function formatCostModel(cost: ApiCostModel): string {
  const symbol = cost.currency === 'CNY' ? '¥' : '$';
  switch (cost.unit) {
    case 'per_second':
      return `${symbol}${cost.price}/秒`;
    case 'per_image':
      return `${symbol}${cost.price}/张`;
    case 'per_1k_char':
      return `${symbol}${cost.price}/千字`;
    case 'per_1k_token':
      return `${symbol}${cost.input}+${cost.output}/1k tok`;
    case 'free':
      return '免费';
  }
}
