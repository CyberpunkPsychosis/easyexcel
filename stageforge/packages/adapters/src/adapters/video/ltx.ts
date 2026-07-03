import { defineMockVideoAdapter } from '../../mock';

/**
 * Lightricks LTX-2 系列。
 * 调研核验（附录 A.1）：原生 4K ~50fps、含口型家族模型、开源底座；
 * Fast 档约 $2.4/min ≈ $0.04/s —— 全场最便宜档之一，适合批量/草稿默认。
 */
export const ltxI2V = defineMockVideoAdapter({
  id: 'ltx-2-fast',
  capability: 'video.i2v',
  displayName: 'LTX-2 Fast',
  provider: 'Lightricks',
  region: 'global',
  caps: {
    maxDurationSec: 10,
    resolutions: ['1080p', '4K'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true,
    supportsReferenceImage: false,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.04, currency: 'USD' },
  notes: '最便宜档之一（$2.4/min）· 原生 4K · 开源底座 · 批量草稿默认',
  confidence: 'verified',
  hue: 175,
});
