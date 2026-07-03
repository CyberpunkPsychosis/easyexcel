import { defineMockMusicAdapter } from '../../mock';

/** Udio —— 配乐 BGM 备选。 */
export const udioMusic = defineMockMusicAdapter({
  id: 'udio-music',
  capability: 'audio.music',
  displayName: 'Udio',
  provider: 'Udio',
  region: 'global',
  caps: { maxDurationSec: 240, async: true },
  cost: { unit: 'per_second', price: 0.005, currency: 'USD' },
  confidence: 'uncertain',
});
