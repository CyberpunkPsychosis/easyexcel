import { defineMockVideoAdapter } from '../../mock';

/**
 * Runway Gen-4.5（2025-12 发布）。
 * 调研（附录 A.1）：60s 单段、1080p、原生音频，综合能力均衡。价格未获核验，占位估值。
 */
export const runwayI2V = defineMockVideoAdapter({
  id: 'runway-gen-4.5',
  capability: 'video.i2v',
  displayName: 'Runway Gen-4.5',
  provider: 'Runway',
  region: 'global',
  caps: {
    maxDurationSec: 60, // ← 全场最长单段
    resolutions: ['1080p'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true,
    supportsReferenceImage: true,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.25, currency: 'USD' }, // 占位估值
  notes: '单段 60s 全场最长 · 综合均衡',
  confidence: 'uncertain',
  hue: 120,
});
