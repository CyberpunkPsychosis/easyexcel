import { defineMockLipsyncAdapter } from '../../mock';

/**
 * MuseTalk 1.5（MIT 开源，自托管 GPU）。
 * 调研：开源口型方案，成本敏感/数据不出域场景适用。
 */
export const musetalk = defineMockLipsyncAdapter({
  id: 'musetalk-1.5',
  capability: 'audio.lipsync',
  displayName: 'MuseTalk 1.5（开源）',
  provider: 'Local',
  region: 'cn',
  caps: { async: true },
  cost: { unit: 'free', currency: 'CNY' },
  notes: 'MIT 开源自托管 · 零边际成本 · 需 GPU',
  confidence: 'verified',
});
