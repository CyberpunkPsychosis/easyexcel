import { getStorage, type RunContext, type SavedAsset } from '@stageforge/core';
import { prisma, type GenerationJob } from '@stageforge/db';
import { renderPlaceholderVideoBuffer } from './media';

/** 为一次生成任务构建 RunContext —— adapter 与 DB/存储/ffmpeg 之间的唯一桥 */
export function buildRunContext(job: GenerationJob): RunContext {
  const storage = getStorage();

  const saveAsset: RunContext['saveAsset'] = async (opts) => {
    const asset = await prisma.asset.create({
      data: {
        projectId: job.projectId,
        kind: opts.kind,
        storageKey: '',
        contentType: opts.contentType,
        meta: (opts.meta ?? {}) as object,
      },
    });
    const key = `${job.projectId}/${asset.id}.${opts.ext}`;
    const body = typeof opts.data === 'string' ? Buffer.from(opts.data) : opts.data;
    await storage.put(key, body, opts.contentType);
    await prisma.asset.update({ where: { id: asset.id }, data: { storageKey: key } });
    return { assetId: asset.id, storageKey: key, contentType: opts.contentType };
  };

  return {
    jobId: job.id,
    projectId: job.projectId,
    shotId: job.shotId ?? undefined,
    saveAsset,
    async renderPlaceholderVideo(opts): Promise<SavedAsset | null> {
      const buf = await renderPlaceholderVideoBuffer(opts);
      if (!buf) return null;
      return saveAsset({
        kind: 'video',
        data: buf,
        contentType: 'video/mp4',
        ext: 'mp4',
        meta: { mock: true, durationSec: opts.durationSec },
      });
    },
    log(msg: string) {
      console.log(`[job ${job.id}] ${msg}`);
    },
  };
}
