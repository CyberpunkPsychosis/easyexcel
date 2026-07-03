import crypto from 'node:crypto';
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
 * 可灵 Kling 3.0（快手，2026-02-04 发布 —— 网传 2025-11 已核验证伪）。
 *
 * 调研核验（附录 A.1，verified）：
 * - Multi-Shot Storyboard：一次定义 3-12 个镜头，自动保持角色/光线/场景连续 —— 多镜连续段落首选
 * - LLM-Stats 盲测榜 Kling v3 排第一（与 AA 榜的 Seedance 第一有分歧，不迷信单一榜单）
 * - 单次生成约 15s；「5 分钟」能力属于独立的 Avatar 长视频模型，非本体
 * - Pro 档约 $20.16/min ≈ $0.336/s
 *
 * 真实接入（M3）：可灵开放平台 image2video，KLING_ACCESS_KEY + KLING_SECRET_KEY
 * 签 HS256 JWT。无 key 自动降级 mock。
 * ⚠️ 接口形态按调研时点的开放平台文档编写（uncertain）——接入时对照最新文档校验
 *    模型名（KLING_MODEL）、时长档位与字段。
 */
const KLING_META: { id: string; displayName: string; hue: number; caps: AdapterCaps } = {
  id: 'kling-3.0',
  displayName: '可灵 Kling 3.0',
  hue: 150,
  caps: {
    maxDurationSec: 15,
    resolutions: ['1080p', '4K'],
    aspectRatios: ['9:16', '16:9'],
    nativeAudio: true, // 部分版本支持对白+环境音+歌声同步
    supportsReferenceImage: true,
    supportsMultiShot: true, // ← 全场唯一 Multi-Shot Storyboard
    async: true,
  },
};

const KLING_COST = { unit: 'per_second', price: 0.336, currency: 'USD' } as const;
const KLING_BASE = process.env.KLING_BASE_URL ?? 'https://api-beijing.klingai.com';

function klingKeys(): { ak: string; sk: string } | null {
  const ak = process.env.KLING_ACCESS_KEY;
  const sk = process.env.KLING_SECRET_KEY;
  return ak && sk ? { ak, sk } : null;
}

/** 可灵开放平台鉴权：AK/SK 签 30 分钟有效的 HS256 JWT */
function klingToken(ak: string, sk: string): string {
  const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({ iss: ak, exp: now + 1800, nbf: now - 5 });
  const sig = crypto.createHmac('sha256', sk).update(`${head}.${payload}`).digest('base64url');
  return `${head}.${payload}.${sig}`;
}

interface MockData {
  kind: 'mock';
  result: { output: AssetOutput; usage: Usage };
}
interface TaskData {
  kind: 'kling';
  durationSec: number;
}

export const klingI2V: ModelAdapter<I2VInput, AssetOutput> = {
  ...KLING_META,
  capability: 'video.i2v',
  provider: 'Kuaishou',
  region: 'cn',
  cost: KLING_COST,
  mock: false, // 有 KLING_ACCESS_KEY/KLING_SECRET_KEY 时真实调用；无 key 降级 mock
  notes: 'Multi-Shot Storyboard（3-12 镜自动连续）· Motion Control 动作迁移 · LLM-Stats 榜第一 · AK/SK 启用真实调用',
  confidence: 'verified',
  estimateCost(input) {
    return computeCostCents(KLING_COST, {
      seconds: clampDuration(input.durationSec, KLING_META.caps.maxDurationSec),
    });
  },
  async submit(input, ctx) {
    const keys = klingKeys();
    // 可灵档位为 5s/10s，就近取档
    const durationSec = clampDuration(input.durationSec, KLING_META.caps.maxDurationSec) <= 7 ? 5 : 10;
    const imageUrl = input.keyframeAssetId ? await ctx.assetPublicUrl(input.keyframeAssetId) : null;
    if (!keys) {
      ctx.log('kling: 无 KLING_ACCESS_KEY/SECRET_KEY，降级 mock 视频');
      const result = await produceMockVideo(KLING_META, input, ctx);
      const data: MockData = { kind: 'mock', result };
      return { externalId: `mock:${ctx.jobId}`, data };
    }
    if (!imageUrl) {
      ctx.log('kling: 无关键帧公网 URL（local 存储或未生成关键帧），降级 mock（生产切 S3/R2）');
      const result = await produceMockVideo(KLING_META, input, ctx);
      const data: MockData = { kind: 'mock', result };
      return { externalId: `mock:${ctx.jobId}`, data };
    }
    const res = await fetch(`${KLING_BASE}/v1/videos/image2video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${klingToken(keys.ak, keys.sk)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: process.env.KLING_MODEL ?? 'kling-v2-master',
        mode: 'pro',
        image: imageUrl,
        prompt: input.prompt,
        duration: String(durationSec),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
      data?: { task_id?: string };
    };
    if (!res.ok || json.code !== 0 || !json.data?.task_id) {
      throw new Error(`可灵 API ${res.status}: ${json.message ?? JSON.stringify(json).slice(0, 200)}`);
    }
    const data: TaskData = { kind: 'kling', durationSec };
    return { externalId: json.data.task_id, data };
  },
  async poll(handle, ctx): Promise<JobStatus<AssetOutput>> {
    const data = handle.data as MockData | TaskData;
    if (data.kind === 'mock') {
      return { state: 'succeeded', output: data.result.output, usage: data.result.usage };
    }
    const keys = klingKeys()!;
    const res = await fetch(`${KLING_BASE}/v1/videos/image2video/${handle.externalId}`, {
      headers: { Authorization: `Bearer ${klingToken(keys.ak, keys.sk)}` },
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { task_status?: string; task_status_msg?: string; task_result?: { videos?: { url?: string }[] } };
    };
    if (!res.ok) return { state: 'failed', error: `可灵查询 ${res.status}` };
    const status = json.data?.task_status ?? '';
    if (status === 'succeed') {
      const url = json.data?.task_result?.videos?.[0]?.url;
      if (!url) return { state: 'failed', error: '可灵任务成功但缺少视频 URL' };
      const dl = await fetch(url);
      if (!dl.ok) return { state: 'failed', error: `下载可灵视频失败: ${dl.status}` };
      const asset = await ctx.saveAsset({
        kind: 'video',
        data: Buffer.from(await dl.arrayBuffer()),
        contentType: 'video/mp4',
        ext: 'mp4',
        meta: { source: 'kling', durationSec: data.durationSec },
      });
      return { state: 'succeeded', output: { asset }, usage: { seconds: data.durationSec } };
    }
    if (status === 'failed') {
      return { state: 'failed', error: `可灵任务失败: ${json.data?.task_status_msg ?? '未知原因'}` };
    }
    return { state: 'running' };
  },
};
