import { defineMockImageAdapter } from '../../mock';

/**
 * Midjourney V7。
 * 调研（附录 A.2）：Omni Reference 角色一致性约 85-90%，适合分镜图阶段出角色定妆图。
 * ⚠️ 百分比来自二手行业报告，UI 只做相对强弱展示、不承诺具体数字。
 */
export const midjourneyT2I = defineMockImageAdapter({
  id: 'midjourney-v7',
  capability: 'image.t2i',
  displayName: 'Midjourney V7',
  provider: 'Midjourney',
  region: 'global',
  caps: {
    resolutions: ['1024x1792'],
    aspectRatios: ['9:16', '16:9', '1:1'],
    supportsReferenceImage: true, // Omni Reference
    async: true,
  },
  cost: { unit: 'per_image', price: 0.05, currency: 'USD' }, // 订阅折算占位
  notes: 'Omni Reference 一致性强（相对值）· 定妆图利器 · 无官方 API 需第三方接入',
  confidence: 'uncertain',
  hue: 320,
});
