import { defineMockTtsAdapter } from '../../mock';

/**
 * ElevenLabs v3。
 * 调研核验：1 分钟高质量样音即可克隆出带呼吸声/停顿感/自然抑扬顿挫的人声 —— 配音环节标杆。
 * 价格按公开档位折算占位，settings 校准。
 */
export const elevenlabsTts = defineMockTtsAdapter({
  id: 'elevenlabs-v3',
  capability: 'audio.tts',
  displayName: 'ElevenLabs v3',
  provider: 'ElevenLabs',
  region: 'global',
  caps: { async: false },
  cost: { unit: 'per_1k_char', price: 0.3, currency: 'USD' },
  notes: '配音标杆 · 1 分钟样音克隆自然人声',
  confidence: 'verified',
});

export const elevenlabsClone = defineMockTtsAdapter({
  id: 'elevenlabs-clone',
  capability: 'audio.voiceclone',
  displayName: 'ElevenLabs 声音克隆',
  provider: 'ElevenLabs',
  region: 'global',
  caps: { async: true },
  cost: { unit: 'per_1k_char', price: 0.3, currency: 'USD' },
  notes: '出海多语配音主力（配合 text.translate + audio.lipsync）',
  confidence: 'verified',
});
