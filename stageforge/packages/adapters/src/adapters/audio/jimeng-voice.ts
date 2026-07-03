import { defineMockTtsAdapter } from '../../mock';

/** 即梦语音（支持自定义声音克隆）—— 国内链路内闭环选项。 */
export const jimengVoice = defineMockTtsAdapter({
  id: 'jimeng-voice',
  capability: 'audio.tts',
  displayName: '即梦语音',
  provider: 'ByteDance',
  region: 'cn',
  caps: { async: false },
  cost: { unit: 'per_1k_char', price: 0.5, currency: 'CNY' }, // 占位估值
  notes: '国内闭环 · 支持自定义声音克隆 · 与剪映生态联动',
  confidence: 'verified',
});
