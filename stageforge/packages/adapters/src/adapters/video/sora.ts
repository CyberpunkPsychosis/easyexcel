import { defineMockVideoAdapter } from '../../mock';

/**
 * OpenAI Sora 2 / Sora 2 Pro。
 * 调研核验（附录 A.1）：物理真实感最强；标准 10-15s、Pro 档最高 25s
 * （网传「90 秒」已核验证伪 —— OpenAI 官方与多方来源均确认无此能力）。
 *
 * ⚠️⚠️ API 已官宣 2026 年 9 月停止服务 —— 新项目不建议作为主力依赖。
 * 本适配器仅作对照/迁移用途保留，UI 显示停服警告。
 */
export const soraI2V = defineMockVideoAdapter({
  id: 'sora-2',
  capability: 'video.i2v',
  displayName: 'Sora 2（即将停服）',
  provider: 'OpenAI',
  region: 'global',
  caps: {
    maxDurationSec: 15, // Pro 档 25s；此处按标准档
    resolutions: ['720p', '1080p'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true,
    supportsReferenceImage: false,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.1, currency: 'USD' },
  notes: '⚠️ API 2026-09 停服，勿作主力 · 物理真实感最强 ·「90秒」系谣言已证伪',
  confidence: 'verified',
  hue: 0,
});
