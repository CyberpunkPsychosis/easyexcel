import {
  SHOT_STAGES,
  computeCostCents,
  type AssetOutput,
  type Storyboard,
  type StoryboardOutput,
  type Usage,
} from '@stageforge/core';
import { getAdapter } from '@stageforge/adapters';
import { prisma, type GenerationJob, Prisma } from '@stageforge/db';
import { buildRunContext } from './context';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 生成任务处理器 —— 对所有能力/所有模型只有这一条路径：
 * 读 job → 找 adapter → submit → poll → 落资产/变体 → 记账。
 * 切模型不会走到任何分支，这就是「加模型 = 纯配置」的运行时保证。
 */
export async function processGeneration(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    console.warn(`generation: job ${jobId} not found, skip`);
    return;
  }
  if (job.status === 'succeeded') return;

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  });

  const ctx = buildRunContext(job);
  try {
    const adapter = getAdapter(job.adapterId);
    const input = job.input as unknown;

    const handle = await adapter.submit(input, ctx);
    let status = await adapter.poll(handle, ctx);
    while (status.state === 'running') {
      await sleep(2000);
      status = await adapter.poll(handle, ctx);
    }
    if (status.state === 'failed') throw new Error(status.error);

    const usage: Usage = status.usage ?? {};
    const cost = computeCostCents(adapter.cost, usage);
    const output = status.output;

    if (job.capability === 'text.storyboard') {
      await materializeStoryboard(job, (output as StoryboardOutput).storyboard);
    } else if (job.shotId && isAssetOutput(output)) {
      // 每次生成 = 一个变体；首个变体自动选中，重roll需手动选优
      const existingSelected = await prisma.variant.findFirst({
        where: { shotId: job.shotId, capability: job.capability, selected: true },
      });
      await prisma.variant.create({
        data: {
          shotId: job.shotId,
          capability: job.capability,
          assetId: output.asset.assetId,
          jobId: job.id,
          selected: !existingSelected,
        },
      });
    }

    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: 'succeeded',
        output: output as Prisma.InputJsonValue,
        actualCostCents: cost.cents,
        currency: cost.currency,
        finishedAt: new Date(),
      },
    });

    // 成本一等公民：每次生成（含所有重roll）都进流水
    const project = await prisma.project.findUnique({ where: { id: job.projectId } });
    if (project && cost.cents > 0) {
      await prisma.creditLedger.create({
        data: {
          userId: project.ownerId,
          projectId: job.projectId,
          jobId: job.id,
          deltaCents: -cost.cents,
          currency: cost.currency,
          kind: 'charge',
          capability: job.capability,
          adapterId: job.adapterId,
          note: `${adapter.displayName} 生成`,
        },
      });
    }
    ctx.log(`succeeded (${adapter.id}, cost ${cost.cents}${cost.currency === 'CNY' ? '分' : '¢'})`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[job ${job.id}] failed:`, message);
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'failed', error: message.slice(0, 2000), finishedAt: new Date() },
    });
  }
}

function isAssetOutput(output: unknown): output is AssetOutput {
  return (
    typeof output === 'object' &&
    output !== null &&
    'asset' in output &&
    typeof (output as AssetOutput).asset?.assetId === 'string'
  );
}

/** 分镜结果落库：集/场/镜 + 每镜默认环节配置 + 角色名对齐 */
async function materializeStoryboard(job: GenerationJob, storyboard: Storyboard): Promise<void> {
  const characters = await prisma.character.findMany({ where: { projectId: job.projectId } });
  const characterIdByName = new Map(characters.map((c) => [c.name, c.id]));
  const existingEpisodes = await prisma.episode.count({ where: { projectId: job.projectId } });

  for (const [ei, ep] of storyboard.episodes.entries()) {
    const episode = await prisma.episode.create({
      data: { projectId: job.projectId, index: existingEpisodes + ei, title: ep.title },
    });
    for (const [si, scene] of ep.scenes.entries()) {
      const sceneRow = await prisma.scene.create({
        data: { episodeId: episode.id, index: si, title: scene.title, location: scene.location },
      });
      for (const [shi, shot] of scene.shots.entries()) {
        const shotRow = await prisma.shot.create({
          data: {
            sceneId: sceneRow.id,
            index: shi,
            dialogue: shot.dialogue,
            visualPrompt: shot.visualPrompt,
            shotType: shot.shotType,
            emotion: shot.emotion,
            cameraMove: shot.cameraMove,
            durationSec: shot.durationSec,
            characterIds: shot.characters
              .map((n) => characterIdByName.get(n))
              .filter((id): id is string => Boolean(id)),
          },
        });
        await prisma.shotStage.createMany({
          data: SHOT_STAGES.map((capability) => ({
            shotId: shotRow.id,
            capability,
            adapterId: null,
          })),
        });
      }
    }
  }
}
