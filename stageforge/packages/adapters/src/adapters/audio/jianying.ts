import { defineMockLipsyncAdapter } from '../../mock';

/** 剪映对口型 —— 国内实践中最常用的轻量口型方案（人肉工作流对应位）。 */
export const jianyingLipsync = defineMockLipsyncAdapter({
  id: 'jianying-lipsync',
  capability: 'audio.lipsync',
  displayName: '剪映 对口型',
  provider: 'ByteDance',
  region: 'cn',
  caps: { async: false },
  cost: { unit: 'free', currency: 'CNY' },
  notes: '国内实践最常用轻量方案 · 后期配音+字幕的标准搭配',
  confidence: 'verified',
});
