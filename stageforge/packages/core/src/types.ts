/**
 * StageForge 核心契约。
 *
 * 架构第一性原则：每个生产环节是一个稳定的「能力（Capability）」插槽，
 * 模型是插在插槽里的「适配器（ModelAdapter）」。模型来来去去，接口不变。
 * 新增一个模型 = 新增一个 adapter 文件 + 注册表加一行，绝不改动流水线代码。
 */

export type Capability =
  | 'text.script' //        剧本生成
  | 'text.storyboard' //    分镜拆解（结构化输出）
  | 'text.translate' //     台词/字幕翻译（出海）
  | 'image.t2i' //          文生图（分镜图/关键帧）
  | 'image.character' //    角色参考图 / 一致性资产生成
  | 'video.t2v' //          文生视频
  | 'video.i2v' //          图生视频（短剧主力，从关键帧出发）
  | 'audio.tts' //          文本转语音
  | 'audio.voiceclone' //   声音克隆
  | 'audio.lipsync' //      口型对齐
  | 'audio.music' //        配乐 BGM
  | 'audio.sfx' //          音效
  | 'render.compose'; //    服务端剪辑合成

/** 单个镜头（Shot）默认要走的环节顺序 —— 流水线 DAG 的主干 */
export const SHOT_STAGES: Capability[] = [
  'image.t2i',
  'video.i2v',
  'audio.tts',
  'audio.lipsync',
];

// ── 计费 ─────────────────────────────────────────────────────

export type Currency = 'USD' | 'CNY';

export type CostModel =
  | { unit: 'per_second'; price: number; currency: Currency } // 视频（price = 每秒单价）
  | { unit: 'per_image'; price: number; currency: Currency } // 图
  | { unit: 'per_1k_char'; price: number; currency: Currency } // TTS
  | { unit: 'per_1k_token'; input: number; output: number; currency: Currency } // LLM
  | { unit: 'free'; currency: Currency }; // 内置/本地（如 ffmpeg 合成）

export interface Credits {
  cents: number; // 以「分」为单位的整数，避免浮点记账
  currency: Currency;
}

export interface Usage {
  seconds?: number;
  images?: number;
  chars?: number;
  inputTokens?: number;
  outputTokens?: number;
}

// ── 能力声明 ──────────────────────────────────────────────────

export interface AdapterCaps {
  /** 单段生成时长上限（秒）。例：Seedance 15s、Veo 3.1 仅 8s —— UI 拼接校验强依赖此字段 */
  maxDurationSec?: number;
  resolutions?: string[];
  aspectRatios?: string[];
  /** 是否原生出声（画面+人声一体） */
  nativeAudio?: boolean;
  /** 是否吃角色参考图（跨镜头一致性的关键） */
  supportsReferenceImage?: boolean;
  /** 是否支持多镜连续（可灵 3.0 Multi-Shot Storyboard） */
  supportsMultiShot?: boolean;
  /** 是否异步长任务（视频类通常 true） */
  async: boolean;
}

// ── 执行上下文（worker 实现，adapter 消费） ─────────────────────

export interface SavedAsset {
  assetId: string;
  storageKey: string;
  contentType: string;
}

export interface CharacterRef {
  characterId: string;
  name: string;
  /** 角色锚参考图资产（正面中性表情） */
  refAssetId?: string | null;
  /** 固定一致性话术，注入支持参考图的适配器 */
  consistencyNote: string;
  /** 克隆音色 id（有则 TTS 用该角色专属音色） */
  voiceId?: string | null;
}

export interface RunContext {
  jobId: string;
  projectId: string;
  shotId?: string;
  /** 把生成结果落成资产（DB 记录 + 对象存储），由 worker 提供实现 */
  saveAsset(opts: {
    kind: 'image' | 'video' | 'audio' | 'final';
    data: Buffer | string;
    contentType: string;
    ext: string;
    meta?: Record<string, unknown>;
  }): Promise<SavedAsset>;
  /**
   * 用 ffmpeg 渲染一段占位视频（mock adapter 用）。
   * 环境无 ffmpeg 时返回 null，调用方降级为 SVG 占位。
   */
  renderPlaceholderVideo(opts: {
    durationSec: number;
    title: string;
    subtitle?: string;
    hue?: number;
  }): Promise<SavedAsset | null>;
  /**
   * 资产的公网可访问 URL（S3 预签名）。真实 i2v 适配器把关键帧传给
   * 第三方 API 时需要；local 存储驱动返回 null（适配器应降级为纯文生）。
   */
  assetPublicUrl(assetId: string): Promise<string | null>;
  log(msg: string): void;
}

// ── 统一适配器接口（灵魂） ─────────────────────────────────────

export interface JobHandle {
  externalId: string;
  /** 同步/mock 型适配器可把结果直接挂在 handle 上，poll 立即 done */
  data?: unknown;
}

export type JobStatus<TOutput = unknown> =
  | { state: 'running'; progress?: number }
  | { state: 'succeeded'; output: TOutput; usage?: Usage }
  | { state: 'failed'; error: string };

export interface ModelAdapter<TInput = unknown, TOutput = unknown> {
  id: string; //             'seedance-2.0' | 'kling-3.0' | 'claude-storyboard' ...
  capability: Capability;
  displayName: string; //    '即梦 Seedance 2.0'
  provider: string; //       'ByteDance' | 'Kuaishou' | 'ElevenLabs' ...
  region: 'cn' | 'global';
  caps: AdapterCaps;
  cost: CostModel;
  /** 是否 mock 实现（无 key 时保证全流程可 demo） */
  mock: boolean;
  /** UI 徽标/提示：调研备注、榜单位次、风险提示（如 Sora 2 API 停服） */
  notes?: string;
  /** 数据可信度：verified=多源核验通过；uncertain=单一来源/存疑，勿在 UI 承诺 */
  confidence?: 'verified' | 'uncertain';

  estimateCost(input: TInput): Credits;
  /** 统一执行入口：提交 → 轮询（同步模型 poll 立即 done） */
  submit(input: TInput, ctx: RunContext): Promise<JobHandle>;
  poll(handle: JobHandle, ctx: RunContext): Promise<JobStatus<TOutput>>;
}

// ── 各能力的 IO 类型 ──────────────────────────────────────────

export interface ScriptInput {
  prompt: string;
  guidance?: string;
}
export interface ScriptOutput {
  text: string;
}

export interface StoryboardInput {
  /** 原始剧本，≤10 万字 */
  script: string;
  guidance?: string;
  /** 项目已有角色名，供模型对齐 */
  characterNames?: string[];
}

export interface TranslateInput {
  text: string;
  targetLang: string;
}
export interface TranslateOutput {
  text: string;
}

export interface T2IInput {
  prompt: string;
  aspectRatio: string;
  characterRefs?: CharacterRef[];
}

export interface I2VInput {
  prompt: string;
  durationSec: number;
  resolution: string;
  aspectRatio: string;
  keyframeAssetId?: string | null;
  dialogue?: string;
  characterRefs?: CharacterRef[];
}

export interface TTSInput {
  text: string;
  voiceId?: string;
}

export interface LipsyncInput {
  videoAssetId: string;
  audioAssetId: string;
}

export interface MusicInput {
  prompt: string;
  durationSec: number;
}

export interface AssetOutput {
  asset: SavedAsset;
}
