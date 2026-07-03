import { defineMockImageAdapter } from '../../mock';

/**
 * IP-Adapter FaceID Plus v2（ComfyUI 生态）。
 * 调研（附录 A.2）：比 Omni Reference 更强的一致性路径，工业化团队适用；
 * 具体百分比（网传 90-95%）来源单一，标 uncertain，UI 只展示相对强弱。
 */
export const ipAdapterFaceId = defineMockImageAdapter({
  id: 'ipadapter-faceid',
  capability: 'image.character',
  displayName: 'IP-Adapter FaceID v2',
  provider: 'Local/ComfyUI',
  region: 'cn',
  caps: {
    aspectRatios: ['9:16', '1:1'],
    supportsReferenceImage: true,
    async: true,
  },
  cost: { unit: 'free', currency: 'CNY' },
  notes: '一致性强于轻量方案（相对值）· 需 ComfyUI 环境',
  confidence: 'uncertain',
  hue: 95,
});
