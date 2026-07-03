import {
  computeCostCents,
  type AssetOutput,
  type Credits,
  type I2VInput,
  type JobStatus,
  type ModelAdapter,
  type RunContext,
} from '@stageforge/core';
import { clampDuration, defineMockVideoAdapter, produceMockVideo } from '../../mock';

/**
 * 即梦 Seedance 2.0（ByteDance/Dreamina）—— 调研结论中的综合最强视频模型。
 *
 * 调研核验（2026-07，附录 A.1，verified）：
 * - Artificial Analysis 盲测竞技场 文生视频/图生视频 双榜第一（Elo 1220 / 1195）
 *   ⚠️ 但 LLM-Stats 榜单上 Kling v3 反超其排第一 —— 两榜有分歧，UI 不承诺唯一第一
 * - 即梦平台单段生成上限 15s（1-3 分钟成片需 4-18 段拼接）
 * - 原生音频：提示词写「人物说：XXX」可出画面+人声，但精确对白口型仍弱 → 推荐后期配音+字幕
 * - 支持「全能参考」：上传角色参考图 @引用 + 固定一致性话术，是国内短剧不跳脸的主流方案
 *
 * 价格（已修正的广传错误）：$9.07/min 是 720p 口径；1080p 实测约 $0.682/s（fal.ai）≈ $40.9/min。
 * 此处按 1080p 口径记 per_second 0.682 USD，settings 可校准。
 *
 * 真实接入（M2）：走火山引擎 Ark 内容生成异步任务 API（提交→轮询），
 * 设置 ARK_API_KEY 后启用；无 key 自动降级 mock。
 * ⚠️ 接口形态按调研时点的 Ark 文档编写（uncertain）——正式接入时对照最新官方文档校验
 *    模型 ID（SEEDANCE_MODEL_ID）与请求字段。
 */
const SEEDANCE_META: { id: string; displayName: string; hue: number; caps: import('@stageforge/core').AdapterCaps } = {
  id: 'seedance-2.0',
  displayName: '即梦 Seedance 2.0',
  hue: 210,
  caps: {
    maxDurationSec: 15,
    resolutions: ['720p', '1080p', '2K'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true,
    supportsReferenceImage: true,
    supportsMultiShot: false,
    async: true,
  },
};

const SEEDANCE_COST = { unit: 'per_second', price: 0.682, currency: 'USD' } as const;

const ARK_BASE = process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3';

function arkKey(): string | undefined {
  return process.env.ARK_API_KEY || undefined;
}

interface ArkHandleData {
  kind: 'ark';
  durationSec: number;
}
interface MockHandleData {
  kind: 'mock';
  result: { output: AssetOutput; usage: import('@stageforge/core').Usage };
}

async function arkFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${ARK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${arkKey()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Ark API ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

export const seedanceI2V: ModelAdapter<I2VInput, AssetOutput> = {
  ...SEEDANCE_META,
  capability: 'video.i2v',
  provider: 'ByteDance',
  region: 'cn',
  cost: SEEDANCE_COST,
  mock: false, // 有 ARK_API_KEY 时真实调用；无 key 运行时降级 mock
  notes: 'AA 竞技场 T2V/I2V 双榜第一 · 全能参考锁角色 · 原生音频（口型精控弱）· ARK_API_KEY 启用真实调用',
  confidence: 'verified',
  estimateCost(input): Credits {
    return computeCostCents(SEEDANCE_COST, {
      seconds: clampDuration(input.durationSec, SEEDANCE_META.caps.maxDurationSec),
    });
  },
  async submit(input, ctx) {
    const durationSec = clampDuration(input.durationSec, SEEDANCE_META.caps.maxDurationSec);
    if (!arkKey()) {
      ctx.log('seedance: 无 ARK_API_KEY，降级 mock 视频');
      const result = await produceMockVideo(SEEDANCE_META, input, ctx);
      const data: MockHandleData = { kind: 'mock', result };
      return { externalId: `mock:${ctx.jobId}`, data };
    }

    // 角色一致性：一致性话术已在流水线注入 prompt；关键帧走图生视频
    const content: Record<string, unknown>[] = [
      {
        type: 'text',
        text: `${input.prompt} --resolution ${input.resolution} --ratio ${input.aspectRatio} --duration ${durationSec}`,
      },
    ];
    if (input.keyframeAssetId) {
      const url = await ctx.assetPublicUrl(input.keyframeAssetId);
      if (url) {
        content.push({ type: 'image_url', image_url: { url } });
      } else {
        ctx.log('seedance: local 存储无公网 URL，关键帧未随请求发送（建议生产切 S3/R2）');
      }
    }

    const task = await arkFetch('/contents/generations/tasks', {
      method: 'POST',
      body: JSON.stringify({
        model: process.env.SEEDANCE_MODEL_ID ?? 'doubao-seedance-pro',
        content,
      }),
    });
    const taskId = String(task.id ?? '');
    if (!taskId) throw new Error(`Ark 未返回任务 id: ${JSON.stringify(task).slice(0, 200)}`);
    const data: ArkHandleData = { kind: 'ark', durationSec };
    return { externalId: taskId, data };
  },
  async poll(handle, ctx): Promise<JobStatus<AssetOutput>> {
    const data = handle.data as ArkHandleData | MockHandleData;
    if (data.kind === 'mock') {
      return { state: 'succeeded', output: data.result.output, usage: data.result.usage };
    }
    const task = await arkFetch(`/contents/generations/tasks/${handle.externalId}`);
    const status = String(task.status ?? '');
    if (status === 'succeeded') {
      const contentObj = task.content as { video_url?: string } | undefined;
      const videoUrl = contentObj?.video_url;
      if (!videoUrl) return { state: 'failed', error: 'Ark 任务成功但缺少 video_url' };
      const res = await fetch(videoUrl);
      if (!res.ok) return { state: 'failed', error: `下载生成视频失败: ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      const asset = await ctx.saveAsset({
        kind: 'video',
        data: buf,
        contentType: 'video/mp4',
        ext: 'mp4',
        meta: { source: 'ark-seedance', durationSec: data.durationSec },
      });
      return { state: 'succeeded', output: { asset }, usage: { seconds: data.durationSec } };
    }
    if (status === 'failed' || status === 'cancelled') {
      return { state: 'failed', error: `Ark 任务 ${status}: ${JSON.stringify(task.error ?? {}).slice(0, 300)}` };
    }
    return { state: 'running' };
  },
};

/** 文生视频变体（对比实验用；短剧场景推荐 i2v）—— 复用同一 Ark 通道，M1 起为 mock 展示位 */
export const seedanceT2V = defineMockVideoAdapter({
  id: 'seedance-2.0-t2v',
  capability: 'video.t2v',
  displayName: '即梦 Seedance 2.0（文生视频）',
  provider: 'ByteDance',
  region: 'cn',
  caps: { ...SEEDANCE_META.caps },
  cost: SEEDANCE_COST,
  notes: '短剧场景不推荐纯文生视频（跳脸），优先 i2v；此项供对比实验',
  confidence: 'verified',
  hue: 200,
});
