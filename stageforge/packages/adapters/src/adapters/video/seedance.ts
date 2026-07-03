import { defineMockVideoAdapter } from '../../mock';

/**
 * 即梦 Seedance 2.0（ByteDance/Dreamina）—— 调研结论中的综合最强视频模型。
 *
 * 调研核验（2026-07，附录 A.1，verified）：
 * - Artificial Analysis 盲测竞技场 文生视频/图生视频 双榜第一（Elo 1220 / 1195）
 *   ⚠️ 但 LLM-Stats 榜单上 Kling v3 反超其排第一 —— 两榜有分歧，UI 不承诺唯一第一
 * - 即梦平台单段生成上限 15s（1-3 分钟成片需 4-18 段拼接）
 * - 原生音频：提示词写「人物说：XXX」可出画面+人声，但精确对白口型仍弱 → 推荐后期配音+字幕
 * - 支持「全能参考」：上传角色参考图 @引用 + 固定一致性话术，是国内短剧不跳脸的主流方案
 *
 * 价格（已修正的广传错误）：$9.07/min 是 720p 口径；1080p 实测约 $0.682/s（fal.ai）≈ $40.9/min。
 * 此处按 1080p 口径记 per_second 0.682 USD，settings 可校准。
 */
export const seedanceI2V = defineMockVideoAdapter({
  id: 'seedance-2.0',
  capability: 'video.i2v',
  displayName: '即梦 Seedance 2.0',
  provider: 'ByteDance',
  region: 'cn',
  caps: {
    maxDurationSec: 15,
    resolutions: ['720p', '1080p', '2K'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true,
    supportsReferenceImage: true,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.682, currency: 'USD' },
  notes: 'AA 竞技场 T2V/I2V 双榜第一 · 全能参考锁角色 · 原生音频（口型精控弱）',
  confidence: 'verified',
  hue: 210,
});

export const seedanceT2V = defineMockVideoAdapter({
  id: 'seedance-2.0-t2v',
  capability: 'video.t2v',
  displayName: '即梦 Seedance 2.0（文生视频）',
  provider: 'ByteDance',
  region: 'cn',
  caps: {
    maxDurationSec: 15,
    resolutions: ['720p', '1080p', '2K'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true,
    supportsReferenceImage: true,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.682, currency: 'USD' },
  notes: '短剧场景不推荐纯文生视频（跳脸），优先 i2v；此项供对比实验',
  confidence: 'verified',
  hue: 200,
});
