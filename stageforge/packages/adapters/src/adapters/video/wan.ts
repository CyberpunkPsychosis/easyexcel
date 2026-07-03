import { defineMockVideoAdapter } from '../../mock';

/**
 * 阿里 Wan 2.7 / 2.6（开源）。
 * 调研核验（附录 A.1）：开源可本地部署、成本最低选项之一（约 $0.05/s 级，本地近乎零边际成本）。
 * 适合做批量/草稿档与本地推理兜底。AA 竞技场近一月新上榜（Wan 2.7 Elo 1092/1099）。
 */
export const wanI2V = defineMockVideoAdapter({
  id: 'wan-2.7',
  capability: 'video.i2v',
  displayName: '阿里 Wan 2.7（开源）',
  provider: 'Alibaba',
  region: 'cn',
  caps: {
    maxDurationSec: 10,
    resolutions: ['720p', '1080p'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true, // 部分版本支持
    supportsReferenceImage: true,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.05, currency: 'USD' },
  notes: '开源可本地部署 · 成本最低档 · 批量/草稿首选',
  confidence: 'verified',
  hue: 25,
});
