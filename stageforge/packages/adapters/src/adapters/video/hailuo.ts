import { defineMockVideoAdapter } from '../../mock';

/**
 * 海螺 Hailuo 2.3（MiniMax）。
 * 调研核验（附录 A.1，verified）：人物表演最佳 —— 微表情、肢体自然，重演技镜头首选；
 * 6-10s（视分辨率档），无原生音频（需搭配后期配音）。价格中等，此处占位估值。
 */
export const hailuoI2V = defineMockVideoAdapter({
  id: 'hailuo-2.3',
  capability: 'video.i2v',
  displayName: '海螺 Hailuo 2.3',
  provider: 'MiniMax',
  region: 'cn',
  caps: {
    maxDurationSec: 10,
    resolutions: ['768p', '1080p'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: false,
    supportsReferenceImage: true,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.2, currency: 'USD' }, // 占位估值（调研仅给出「中等」）
  notes: '人物表演最佳（微表情/肢体自然）· 重演技镜头首选 · 无原生音频',
  confidence: 'verified',
  hue: 30,
});
