import {
  computeCostCents,
  type AdapterCaps,
  type AssetOutput,
  type I2VInput,
  type JobStatus,
  type ModelAdapter,
  type Usage,
} from '@stageforge/core';
import { clampDuration, produceMockVideo } from '../../mock';

/**
 * 海螺 Hailuo 2.3（MiniMax）。
 * 调研核验（附录 A.1，verified）：人物表演最佳 —— 微表情、肢体自然，重演技镜头首选；
 * 6-10s（视分辨率档），无原生音频（需搭配后期配音）。价格中等，此处占位估值。
 *
 * 真实接入（M3）：MiniMax 视频生成异步任务（提交→查询→取文件），
 * MINIMAX_API_KEY（+ 可选 MINIMAX_GROUP_ID）启用。无 key 自动降级 mock。
 * ⚠️ 接口形态按调研时点的 MiniMax 开放平台文档编写（uncertain）——接入时对照最新文档
 *    校验模型名（HAILUO_MODEL）与查询/取件端点。
 */
const HAILUO_META: { id: string; displayName: string; hue: number; caps: AdapterCaps } = {
  id: 'hailuo-2.3',
  displayName: '海螺 Hailuo 2.3',
  hue: 30,
  caps: {
    maxDurationSec: 10,
    resolutions: ['768p', '1080p'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: false,
    supportsReferenceImage: true,
    supportsMultiShot: false,
    async: true,
  },
};

const HAILUO_COST = { unit: 'per_second', price: 0.2, currency: 'USD' } as const; // 占位估值
const MINIMAX_BASE = process.env.MINIMAX_BASE_URL ?? 'https://api.minimax.chat';

function minimaxKey(): string | undefined {
  return process.env.MINIMAX_API_KEY || undefined;
}

interface MockData {
  kind: 'mock';
  result: { output: AssetOutput; usage: Usage };
}
interface TaskData {
  kind: 'hailuo';
  durationSec: number;
}

async function minimaxGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${MINIMAX_BASE}${path}`, {
    headers: { Authorization: `Bearer ${minimaxKey()}` },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`MiniMax API ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

export const hailuoI2V: ModelAdapter<I2VInput, AssetOutput> = {
  ...HAILUO_META,
  capability: 'video.i2v',
  provider: 'MiniMax',
  region: 'cn',
  cost: HAILUO_COST,
  mock: false, // 有 MINIMAX_API_KEY 时真实调用；无 key 降级 mock
  notes: '人物表演最佳（微表情/肢体自然）· 重演技镜头首选 · 无原生音频 · MINIMAX_API_KEY 启用真实调用',
  confidence: 'verified',
  estimateCost(input) {
    return computeCostCents(HAILUO_COST, {
      seconds: clampDuration(input.durationSec, HAILUO_META.caps.maxDurationSec),
    });
  },
  async submit(input, ctx) {
    const durationSec = clampDuration(input.durationSec, HAILUO_META.caps.maxDurationSec);
    if (!minimaxKey()) {
      ctx.log('hailuo: 无 MINIMAX_API_KEY，降级 mock 视频');
      const result = await produceMockVideo(HAILUO_META, input, ctx);
      const data: MockData = { kind: 'mock', result };
      return { externalId: `mock:${ctx.jobId}`, data };
    }
    const body: Record<string, unknown> = {
      model: process.env.HAILUO_MODEL ?? 'MiniMax-Hailuo-02',
      prompt: input.prompt,
    };
    if (input.keyframeAssetId) {
      const url = await ctx.assetPublicUrl(input.keyframeAssetId);
      if (url) body.first_frame_image = url;
      else ctx.log('hailuo: local 存储无公网 URL，关键帧未随请求发送（生产切 S3/R2）');
    }
    const res = await fetch(`${MINIMAX_BASE}/v1/video_generation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${minimaxKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      task_id?: string;
      base_resp?: { status_code?: number; status_msg?: string };
    };
    if (!res.ok || !json.task_id) {
      throw new Error(
        `MiniMax API ${res.status}: ${json.base_resp?.status_msg ?? JSON.stringify(json).slice(0, 200)}`,
      );
    }
    const data: TaskData = { kind: 'hailuo', durationSec };
    return { externalId: json.task_id, data };
  },
  async poll(handle, ctx): Promise<JobStatus<AssetOutput>> {
    const data = handle.data as MockData | TaskData;
    if (data.kind === 'mock') {
      return { state: 'succeeded', output: data.result.output, usage: data.result.usage };
    }
    const q = (await minimaxGet(`/v1/query/video_generation?task_id=${handle.externalId}`)) as {
      status?: string;
      file_id?: string;
    };
    const status = (q.status ?? '').toLowerCase();
    if (status === 'success' && q.file_id) {
      const groupParam = process.env.MINIMAX_GROUP_ID ? `&GroupId=${process.env.MINIMAX_GROUP_ID}` : '';
      const f = (await minimaxGet(`/v1/files/retrieve?file_id=${q.file_id}${groupParam}`)) as {
        file?: { download_url?: string };
      };
      const url = f.file?.download_url;
      if (!url) return { state: 'failed', error: 'MiniMax 任务成功但缺少下载 URL' };
      const dl = await fetch(url);
      if (!dl.ok) return { state: 'failed', error: `下载海螺视频失败: ${dl.status}` };
      const asset = await ctx.saveAsset({
        kind: 'video',
        data: Buffer.from(await dl.arrayBuffer()),
        contentType: 'video/mp4',
        ext: 'mp4',
        meta: { source: 'hailuo', durationSec: data.durationSec },
      });
      return { state: 'succeeded', output: { asset }, usage: { seconds: data.durationSec } };
    }
    if (status === 'fail' || status === 'failed') {
      return { state: 'failed', error: 'MiniMax 任务失败' };
    }
    return { state: 'running' };
  },
};
