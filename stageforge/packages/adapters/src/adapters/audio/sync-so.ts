import { defineMockLipsyncAdapter } from '../../mock';

/**
 * sync.so Sync-3 —— 口型对齐/视觉配音专用层（Wav2Lip 血统后继者）。
 * 调研核验：可处理遮挡、4K ProRes、多人、多机位、暗光、快速运镜与快语速对白；
 * 有 Web Studio / Premiere 插件 / ComfyUI 节点，适合叠在任意视频模型之上做后处理。
 */
export const syncSo = defineMockLipsyncAdapter({
  id: 'sync-so',
  capability: 'audio.lipsync',
  displayName: 'sync.so Sync-3',
  provider: 'sync.',
  region: 'global',
  caps: { async: true },
  cost: { unit: 'per_second', price: 0.05, currency: 'USD' }, // 占位估值
  notes: '专业口型层 · 多人/遮挡/快语速可用 · 出海视觉配音关键件',
  confidence: 'verified',
});
