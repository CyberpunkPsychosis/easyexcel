import type { CostModel, Credits, Usage } from './types';

/**
 * 用适配器声明的计费模型 + 实际用量算成本（整数分）。
 * 注意：这是「单次生成成本」。UI 展示时必须区分
 * 「单次生成成本」和「预计总成本（含重roll）」—— 行业单次成功率不足 40%，
 * 理想镜头常需 20+ 次重roll，抽卡税才是真实成本大头（调研附录 A.3）。
 */
export function computeCostCents(model: CostModel, usage: Usage): Credits {
  switch (model.unit) {
    case 'per_second':
      return { cents: Math.round(model.price * 100 * (usage.seconds ?? 0)), currency: model.currency };
    case 'per_image':
      return { cents: Math.round(model.price * 100 * (usage.images ?? 1)), currency: model.currency };
    case 'per_1k_char':
      return {
        cents: Math.round((model.price * 100 * (usage.chars ?? 0)) / 1000),
        currency: model.currency,
      };
    case 'per_1k_token':
      return {
        cents: Math.round(
          (model.input * 100 * (usage.inputTokens ?? 0)) / 1000 +
            (model.output * 100 * (usage.outputTokens ?? 0)) / 1000,
        ),
        currency: model.currency,
      };
    case 'free':
      return { cents: 0, currency: model.currency };
  }
}

/** 预计总成本 = 单次成本 × 预期重roll次数（默认按熟手 3 次估） */
export function estimateWithRerolls(single: Credits, expectedRolls = 3): Credits {
  return { cents: single.cents * expectedRolls, currency: single.currency };
}

export function formatCents(cents: number, currency: string): string {
  const symbol = currency === 'CNY' ? '¥' : '$';
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
