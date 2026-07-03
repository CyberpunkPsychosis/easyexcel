import { defineMockImageAdapter } from '../../mock';

/**
 * 即梦「全能参考」—— 角色一致性资产生成（image.character）。
 * 调研实践（附录 A.2，verified）：上传一张正面中性参考图，每段提示词 @引用
 * + 固定话术「同一角色，服装一致，发型不变」，是国内短剧不跳脸的最常用轻量方案。
 */
export const jimengOmniRef = defineMockImageAdapter({
  id: 'jimeng-omniref',
  capability: 'image.character',
  displayName: '即梦 全能参考',
  provider: 'ByteDance',
  region: 'cn',
  caps: {
    aspectRatios: ['9:16', '1:1'],
    supportsReferenceImage: true,
    async: false,
  },
  cost: { unit: 'per_image', price: 0.5, currency: 'CNY' },
  notes: '国内短剧不跳脸主流方案 · 一张锚图 + @引用 + 固定话术',
  confidence: 'verified',
  hue: 215,
});
