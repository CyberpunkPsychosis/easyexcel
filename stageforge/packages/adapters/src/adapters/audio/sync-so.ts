import type { AssetOutput, JobStatus, LipsyncInput, ModelAdapter } from '@stageforge/core';

/**
 * sync.so Sync-3 —— 口型对齐/视觉配音专用层（Wav2Lip 血统后继者）。
 * 调研核验：可处理遮挡、4K ProRes、多人、多机位、暗光、快速运镜与快语速对白；
 * 有 Web Studio / Premiere 插件 / ComfyUI 节点，适合叠在任意视频模型之上做后处理。
 *
 * 真实接入（M3）：SYNC_SO_API_KEY 启用 generate 提交+轮询；视频/音频经 S3 presigned URL 传参
 * （local 存储无公网 URL 时自动降级 mock 透传）。
 * ⚠️ 接口形态按调研时点的 sync.so v2 文档编写（uncertain）——正式接入时对照最新官方文档校验
 *    模型名（SYNC_SO_MODEL）与字段。
 */
const SYNC_BASE = process.env.SYNC_SO_BASE_URL ?? 'https://api.sync.so/v2';

function syncKey(): string | undefined {
  return process.env.SYNC_SO_API_KEY || undefined;
}

interface PassthroughData {
  kind: 'passthrough';
  videoAssetId: string;
}

export const syncSo: ModelAdapter<LipsyncInput, AssetOutput> = {
  id: 'sync-so',
  capability: 'audio.lipsync',
  displayName: 'sync.so Sync-3',
  provider: 'sync.',
  region: 'global',
  caps: { async: true },
  cost: { unit: 'per_second', price: 0.05, currency: 'USD' }, // 占位估值，settings 校准
  mock: false, // 有 SYNC_SO_API_KEY 时真实调用；无 key 运行时降级透传
  notes: '专业口型层 · 多人/遮挡/快语速可用 · 出海视觉配音关键件 · SYNC_SO_API_KEY 启用真实调用',
  confidence: 'verified',
  estimateCost() {
    return { cents: 25, currency: 'USD' }; // 约 5s 镜头的占位估值
  },
  async submit(input, ctx) {
    const videoUrl = await ctx.assetPublicUrl(input.videoAssetId);
    const audioUrl = await ctx.assetPublicUrl(input.audioAssetId);
    if (!syncKey() || !videoUrl || !audioUrl) {
      ctx.log(
        !syncKey()
          ? 'sync.so: 无 SYNC_SO_API_KEY，mock 透传视频资产'
          : 'sync.so: local 存储无公网 URL，mock 透传（生产切 S3/R2 后自动启用真实口型）',
      );
      const data: PassthroughData = { kind: 'passthrough', videoAssetId: input.videoAssetId };
      return { externalId: `mock:${ctx.jobId}`, data };
    }
    const res = await fetch(`${SYNC_BASE}/generate`, {
      method: 'POST',
      headers: { 'x-api-key': syncKey()!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.SYNC_SO_MODEL ?? 'lipsync-2-pro',
        input: [
          { type: 'video', url: videoUrl },
          { type: 'audio', url: audioUrl },
        ],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: unknown };
    if (!res.ok || !json.id) {
      throw new Error(`sync.so API ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    }
    return { externalId: json.id };
  },
  async poll(handle, ctx): Promise<JobStatus<AssetOutput>> {
    const data = handle.data as PassthroughData | undefined;
    if (data?.kind === 'passthrough') {
      return {
        state: 'succeeded',
        output: { asset: { assetId: data.videoAssetId, storageKey: '', contentType: 'video/mp4' } },
        usage: { seconds: 5 },
      };
    }
    const res = await fetch(`${SYNC_BASE}/generate/${handle.externalId}`, {
      headers: { 'x-api-key': syncKey()! },
    });
    const json = (await res.json().catch(() => ({}))) as {
      status?: string;
      outputUrl?: string;
      error?: unknown;
    };
    if (!res.ok) return { state: 'failed', error: `sync.so 查询 ${res.status}` };
    const status = (json.status ?? '').toUpperCase();
    if (status === 'COMPLETED' && json.outputUrl) {
      const dl = await fetch(json.outputUrl);
      if (!dl.ok) return { state: 'failed', error: `下载口型结果失败: ${dl.status}` };
      const asset = await ctx.saveAsset({
        kind: 'video',
        data: Buffer.from(await dl.arrayBuffer()),
        contentType: 'video/mp4',
        ext: 'mp4',
        meta: { source: 'sync-so' },
      });
      return { state: 'succeeded', output: { asset }, usage: { seconds: 5 } };
    }
    if (status === 'FAILED' || status === 'REJECTED' || status === 'CANCELED') {
      return { state: 'failed', error: `sync.so 任务 ${status}: ${JSON.stringify(json.error ?? {}).slice(0, 200)}` };
    }
    return { state: 'running' };
  },
};
