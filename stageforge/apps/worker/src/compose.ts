import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getStorage } from '@stageforge/core';
import { prisma } from '@stageforge/db';
import { composeVertical, type ComposeSegment } from './media';

/**
 * 成片合成：按 集→场→镜 顺序拼接每个镜头选中的视频变体，
 * 烧台词字幕，输出 9:16 mp4 并回写 Episode.finalAssetId。
 */
export async function processCompose(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job?.episodeId) {
    console.warn(`compose: job ${jobId} missing episodeId, skip`);
    return;
  }
  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  });
  await prisma.episode.update({ where: { id: job.episodeId }, data: { status: 'rendering' } });

  const storage = getStorage();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-compose-'));
  try {
    const episode = await prisma.episode.findUniqueOrThrow({
      where: { id: job.episodeId },
      include: {
        scenes: {
          orderBy: { index: 'asc' },
          include: {
            shots: {
              orderBy: { index: 'asc' },
              include: { variants: { include: { asset: true } } },
            },
          },
        },
      },
    });

    // 字幕语言：默认原文；lang 指定时用出海译文（shot.translations[lang]）
    const lang = (job.input as { lang?: string }).lang;

    const segments: ComposeSegment[] = [];
    let skipped = 0;
    for (const scene of episode.scenes) {
      for (const shot of scene.shots) {
        const selected = shot.variants.find(
          (v) => v.selected && (v.capability === 'video.i2v' || v.capability === 'video.t2v'),
        );
        if (!selected || !selected.asset.contentType.startsWith('video/')) {
          skipped += 1;
          continue;
        }
        const filePath = path.join(tmp, `${segments.length}.mp4`);
        await fs.writeFile(filePath, await storage.get(selected.asset.storageKey));
        const translations = shot.translations as Record<string, string>;
        const dialogue = (lang && translations[lang]) || shot.dialogue;
        segments.push({ filePath, dialogue });
      }
    }

    if (segments.length === 0) {
      throw new Error(
        '该集没有任何可拼接的 mp4 视频变体。请先为镜头生成视频（若 worker 环境无 ffmpeg，mock 视频会退化为 SVG 占位，无法合成）。',
      );
    }
    if (skipped > 0) console.warn(`compose: ${skipped} 个镜头缺少已选视频变体，已跳过`);

    // BGM 混音：episode.musicAssetId 存在则加音轨（-shortest 对齐视频长度）
    let musicPath: string | undefined;
    if (episode.musicAssetId) {
      const musicAsset = await prisma.asset.findUnique({ where: { id: episode.musicAssetId } });
      if (musicAsset?.storageKey) {
        const ext = musicAsset.contentType.includes('mpeg') ? 'mp3' : 'wav';
        musicPath = path.join(tmp, `bgm.${ext}`);
        await fs.writeFile(musicPath, await storage.get(musicAsset.storageKey));
      }
    }

    const outPath = path.join(tmp, 'final.mp4');
    await composeVertical(segments, outPath, { musicPath });
    const finalBuf = await fs.readFile(outPath);

    const asset = await prisma.asset.create({
      data: {
        projectId: job.projectId,
        kind: 'final',
        storageKey: '',
        contentType: 'video/mp4',
        meta: {
          episodeId: episode.id,
          lang: lang ?? '',
          segments: segments.length,
          skippedShots: skipped,
          hasMusic: Boolean(musicPath),
        },
      },
    });
    const key = `${job.projectId}/${asset.id}.mp4`;
    await storage.put(key, finalBuf, 'video/mp4');
    await prisma.asset.update({ where: { id: asset.id }, data: { storageKey: key } });

    await prisma.episode.update({
      where: { id: episode.id },
      data: { status: 'rendered', finalAssetId: asset.id },
    });
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'succeeded',
        output: { finalAssetId: asset.id, segments: segments.length, skippedShots: skipped },
        finishedAt: new Date(),
      },
    });
    console.log(`[compose ${job.id}] 成片完成：${segments.length} 段, asset ${asset.id}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[compose ${job.id}] failed:`, message);
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: message.slice(0, 2000), finishedAt: new Date() },
    });
    await prisma.episode.update({ where: { id: job.episodeId }, data: { status: 'draft' } });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
