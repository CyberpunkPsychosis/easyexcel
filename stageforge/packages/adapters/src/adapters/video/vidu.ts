import { defineMockVideoAdapter } from '../../mock';

/**
 * 生数科技 Vidu Q3。
 * 调研：AA 文生视频（带音频）榜第 13（Elo 1081）；跑量场景有性价比；
 * 阅文漫剧助手 2026-01 已接入 Vidu（产业采信信号）。价格为占位估值。
 */
export const viduI2V = defineMockVideoAdapter({
  id: 'vidu-q3',
  capability: 'video.i2v',
  displayName: 'Vidu Q3',
  provider: '生数科技',
  region: 'cn',
  caps: {
    maxDurationSec: 10,
    resolutions: ['720p', '1080p'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: false,
    supportsReferenceImage: true,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.08, currency: 'USD' }, // 占位估值
  notes: '跑量性价比选项 · 阅文漫剧助手已接入',
  confidence: 'uncertain',
  hue: 280,
});
