import { defineMockImageAdapter } from '../../mock';

/** Flux Kontext（Black Forest Labs）—— 编辑/参考驱动的图像生成，可做关键帧微调。 */
export const fluxT2I = defineMockImageAdapter({
  id: 'flux-kontext',
  capability: 'image.t2i',
  displayName: 'Flux Kontext',
  provider: 'Black Forest Labs',
  region: 'global',
  caps: {
    resolutions: ['1024x1792'],
    aspectRatios: ['9:16', '16:9', '1:1'],
    supportsReferenceImage: true,
    async: false,
  },
  cost: { unit: 'per_image', price: 0.04, currency: 'USD' },
  notes: '参考驱动编辑强 · 关键帧微调好用',
  confidence: 'uncertain',
  hue: 45,
});
