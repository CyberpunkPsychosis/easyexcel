import { defineMockImageAdapter } from '../../mock';

/**
 * ComfyUI 本地工作流（SDXL/SD3.5 + IP-Adapter FaceID Plus v2 + ControlNet + ADetailer）。
 * 调研（附录 A.2）：工业化团队的角色一致性组合拳，效果强于纯 API 方案但搭建门槛高。
 * 本地推理近乎零边际成本。
 */
export const comfyuiT2I = defineMockImageAdapter({
  id: 'comfyui-sdxl',
  capability: 'image.t2i',
  displayName: 'ComfyUI 本地流（SDXL）',
  provider: 'Local',
  region: 'cn',
  caps: {
    resolutions: ['1024x1792', '自定义'],
    aspectRatios: ['9:16', '16:9', '1:1'],
    supportsReferenceImage: true,
    async: true,
  },
  cost: { unit: 'free', currency: 'CNY' },
  notes: 'IP-Adapter+ControlNet 组合拳 · 工业化团队方案 · 需自备 GPU',
  confidence: 'verified',
  hue: 90,
});
