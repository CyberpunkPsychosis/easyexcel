/**
 * ══════════════════════════════════════════════════════════════════
 *  新增一个视频模型 = 复制本文件改配置 + registry.ts 加一行。就这么多。
 *  流水线（worker/UI/成本记账/变体管理）零改动 —— 这是 M1 DoD 的验收项。
 * ══════════════════════════════════════════════════════════════════
 *
 * 步骤：
 *   1. cp _example-newmodel.ts happyhorse.ts，按新模型填 id/caps/cost/notes
 *   2. registry.ts 的 ALL_ADAPTERS 数组里加一行 `happyhorseI2V,`
 *   3. 完成。UI 的 Stage Rail 下拉、成本估算、生成流水线自动识别新模型。
 *
 * 接真实 API 时：把 defineMockVideoAdapter 换成手写 ModelAdapter 实现
 * （submit 调第三方提交接口、poll 查任务状态），接口契约不变。
 * 参考 text/claude.ts —— 真实与 mock 适配器在流水线眼里没有任何区别。
 */
import { defineMockVideoAdapter } from '../../mock';

// 示例：阿里 HappyHorse-1.1 —— 调研标注「2026 上半年竞技场黑马，值得预留 adapter 位」
export const happyhorseExample = defineMockVideoAdapter({
  id: 'example-happyhorse-1.1',
  capability: 'video.i2v',
  displayName: '示例：HappyHorse-1.1',
  provider: 'Alibaba-ATH',
  region: 'cn',
  caps: {
    maxDurationSec: 10,
    resolutions: ['1080p'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true,
    supportsReferenceImage: true,
    supportsMultiShot: false,
    async: true,
  },
  cost: { unit: 'per_second', price: 0.165, currency: 'USD' }, // $9.9/min（AA 榜数据）
  notes: '本条目是「一文件加模型」的活示例，默认未注册',
  confidence: 'uncertain',
  hue: 340,
});
