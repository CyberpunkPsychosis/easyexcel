import { svgPlaceholder, type AssetOutput, type T2IInput } from '@stageforge/core';
import { defineMockAdapter } from '../../mock';

/**
 * LoRA / Dreambooth 训练任务 —— 角色一致性的效果上限方案（附录 A.2）。
 * 长期 IP 适用：训练产出的权重登记到 Character.modelAssets，供支持的适配器调用。
 * M1 为 mock（产出「训练完成」占位凭证）；真实实现是小时级训练任务。
 */
export const loraTraining = defineMockAdapter<T2IInput, AssetOutput>(
  {
    id: 'lora-training',
    capability: 'image.character',
    displayName: 'LoRA 角色训练',
    provider: 'Local/云训练',
    region: 'cn',
    caps: { supportsReferenceImage: true, async: true },
    cost: { unit: 'per_image', price: 20, currency: 'CNY' }, // 按次训练占位估值
    notes: '一致性效果上限方案 · 需训练时间与算力 · 适合长期 IP',
    confidence: 'verified',
  },
  () => ({ images: 1 }),
  async (input, ctx) => {
    const asset = await ctx.saveAsset({
      kind: 'image',
      data: svgPlaceholder({
        title: 'LoRA 权重（mock）',
        subtitle: input.prompt.slice(0, 60),
        badge: 'lora-training',
        hue: 60,
      }),
      contentType: 'image/svg+xml',
      ext: 'svg',
      meta: { kind: 'lora-weights-placeholder' },
    });
    return { output: { asset }, usage: { images: 1 } };
  },
);
