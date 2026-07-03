import { config } from 'dotenv';
// 单一 .env 放 monorepo 根；npm -w 运行时 cwd 是 apps/worker
config({ path: '../../.env' });
config(); // 兜底：允许直接在根目录跑

import { Worker } from 'bullmq';
import { COMPOSE_QUEUE, GENERATION_QUEUE, redisConnection, type QueuePayload } from '@stageforge/core';
import { processGeneration } from './generation';
import { processCompose } from './compose';
import { hasFfmpeg } from './media';

async function main() {
  console.log('StageForge worker 启动');
  console.log(`  ffmpeg: ${hasFfmpeg() ? '可用 ✓' : '不可用 ✗（mock 视频将退化为 SVG，合成不可用）'}`);

  const connection = redisConnection();

  const generationWorker = new Worker<QueuePayload>(
    GENERATION_QUEUE,
    async (job) => processGeneration(job.data.jobId),
    { connection, concurrency: 4 },
  );
  const composeWorker = new Worker<QueuePayload>(
    COMPOSE_QUEUE,
    async (job) => processCompose(job.data.jobId),
    { connection, concurrency: 1 },
  );

  for (const [name, w] of [
    ['generation', generationWorker],
    ['compose', composeWorker],
  ] as const) {
    w.on('failed', (job, err) => console.error(`[${name}] queue job ${job?.id} failed:`, err.message));
    w.on('error', (err) => console.error(`[${name}] worker error:`, err.message));
  }

  const shutdown = async () => {
    console.log('worker 关闭中…');
    await Promise.all([generationWorker.close(), composeWorker.close()]);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`  队列: ${GENERATION_QUEUE}(并发4) / ${COMPOSE_QUEUE}(并发1) — 等待任务`);
}

main().catch((e) => {
  console.error('worker 启动失败:', e);
  process.exit(1);
});
