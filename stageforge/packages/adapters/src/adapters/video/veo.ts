import { defineMockVideoAdapter } from '../../mock';

/**
 * Google Veo 3.1。
 * 调研核验（附录 A.1，verified）：音画同步质量业界最好（48kHz 对白+环境音），
 * 但单段仅 8s —— 1 分钟长镜头需拼 8 段以上，UI 依据 maxDurationSec 强制提示。
 * Standard 档约 $24/min ≈ $0.40/s；Lite 档约 $4.8-5/min。
 */
export const veoI2V = defineMockVideoAdapter({
  id: 'veo-3.1',
  capability: 'video.i2v',
  displayName: 'Google Veo 3.1',
  provider: 'Google',
  region: 'global',
  caps: {
    maxDurationSec: 8, // ← 全场最短，拼接点最多
    resolutions: ['720p', '1080p', '4K'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true,
    supportsReferenceImage: false,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.4, currency: 'USD' },
  notes: '音画同步质量标杆（48kHz）· 单段仅 8s 拼接点多 · 最贵档之一',
  confidence: 'verified',
  hue: 260,
});
