import { defineMockImageAdapter } from '../../mock';

/**
 * 即梦文生图（豆包同底模）。
 * 调研：与即梦视频同底模、中文理解强、上手门槛低 —— 国内短剧分镜图主流选择。
 * 参考单价：即梦 3.0 Pro 10 秒视频 100 积分≈10 元；图像积分价此处按占位估。
 */
export const jimengT2I = defineMockImageAdapter({
  id: 'jimeng-t2i',
  capability: 'image.t2i',
  displayName: '即梦文生图（豆包）',
  provider: 'ByteDance',
  region: 'cn',
  caps: {
    resolutions: ['1024x1792', '2048x3584'],
    aspectRatios: ['9:16', '16:9', '1:1'],
    supportsReferenceImage: true,
    async: false,
  },
  cost: { unit: 'per_image', price: 0.5, currency: 'CNY' }, // 占位估值，settings 校准
  notes: '与即梦视频同底模 · 中文理解强 · 国内分镜图主流',
  confidence: 'verified',
  hue: 205,
});
