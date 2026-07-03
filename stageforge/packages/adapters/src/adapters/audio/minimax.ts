import { defineMockTtsAdapter } from '../../mock';

/** MiniMax 语音 —— 国内 TTS/克隆备选。 */
export const minimaxTts = defineMockTtsAdapter({
  id: 'minimax-tts',
  capability: 'audio.tts',
  displayName: 'MiniMax 语音',
  provider: 'MiniMax',
  region: 'cn',
  caps: { async: false },
  cost: { unit: 'per_1k_char', price: 0.4, currency: 'CNY' }, // 占位估值
  confidence: 'uncertain',
});
