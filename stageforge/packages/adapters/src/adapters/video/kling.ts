import { defineMockVideoAdapter } from '../../mock';

/**
 * 可灵 Kling 3.0（快手，2026-02-04 发布 —— 网传 2025-11 已核验证伪）。
 *
 * 调研核验（附录 A.1，verified）：
 * - Multi-Shot Storyboard：一次定义 3-12 个镜头，自动保持角色/光线/场景连续 —— 多镜连续段落首选
 * - LLM-Stats 盲测榜 Kling v3 排第一（与 AA 榜的 Seedance 第一有分歧，不迷信单一榜单）
 * - 单次生成约 15s；「5 分钟」能力属于独立的 Avatar 长视频模型，非本体
 * - Pro 档约 $20.16/min ≈ $0.336/s
 */
export const klingI2V = defineMockVideoAdapter({
  id: 'kling-3.0',
  capability: 'video.i2v',
  displayName: '可灵 Kling 3.0',
  provider: 'Kuaishou',
  region: 'cn',
  caps: {
    maxDurationSec: 15,
    resolutions: ['1080p', '4K'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true, // 部分版本支持对白+环境音+歌声同步
    supportsReferenceImage: true,
    supportsMultiShot: true, // ← 全场唯一 Multi-Shot Storyboard
    async: true,
  },
  cost: { unit: 'per_second', price: 0.336, currency: 'USD' },
  notes: 'Multi-Shot Storyboard（3-12 镜自动连续）· Motion Control 动作迁移 · LLM-Stats 榜第一',
  confidence: 'verified',
  hue: 150,
});
