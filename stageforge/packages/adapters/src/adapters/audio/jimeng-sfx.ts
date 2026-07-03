import { defineMockMusicAdapter } from '../../mock';

/** 即梦/剪映 AI 音效 —— 国内实践标配（调研工作流：剪映做对口型和音效）。 */
export const jimengSfx = defineMockMusicAdapter({
  id: 'jimeng-sfx',
  capability: 'audio.sfx',
  displayName: '即梦 AI 音效',
  provider: 'ByteDance',
  region: 'cn',
  caps: { maxDurationSec: 30, async: false },
  cost: { unit: 'per_second', price: 0.01, currency: 'CNY' },
  confidence: 'verified',
});
