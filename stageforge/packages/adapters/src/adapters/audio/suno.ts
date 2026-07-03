import { defineMockMusicAdapter } from '../../mock';

/** Suno —— 配乐 BGM 生成。 */
export const sunoMusic = defineMockMusicAdapter({
  id: 'suno-music',
  capability: 'audio.music',
  displayName: 'Suno',
  provider: 'Suno',
  region: 'global',
  caps: { maxDurationSec: 240, async: true },
  cost: { unit: 'per_second', price: 0.005, currency: 'USD' }, // 订阅折算占位
  confidence: 'uncertain',
});
