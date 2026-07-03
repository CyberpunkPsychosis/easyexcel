import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { GENERATION_QUEUE, getQueue, getStorage } from '@stageforge/core';
import { getAdapter } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, badRequest, handleError, notFound } from '@/lib/server';
import { resolveAdapterId } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('generate'), prompt: z.string().max(1000).optional(), adapterId: z.string().optional() }),
  z.object({ mode: z.literal('upload'), dataUrl: z.string().max(8_000_000) }),
]);

/**
 * 角色参考图（一致性锚图）：
 * - generate: 走 image.character 能力（即梦全能参考 / IP-Adapter / LoRA，任意可切）
 * - upload:   用户上传定妆照（dataURL）
 */
export async function POST(req: NextRequest, { params }: { params: { characterId: string } }) {
  try {
    const user = await requireUser();
    const character = await prisma.character.findUnique({ where: { id: params.characterId } });
    if (!character) notFound('角色不存在');
    await assertProjectAccess(character.projectId, user.id);
    const body = schema.parse(await req.json());

    if (body.mode === 'upload') {
      const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/.exec(body.dataUrl);
      if (!match) badRequest('dataUrl 格式不合法（需 data:image/*;base64,…）');
      const [, contentType, b64] = match;
      const buf = Buffer.from(b64, 'base64');
      const ext = contentType.includes('png') ? 'png' : contentType.includes('svg') ? 'svg' : 'jpg';
      const asset = await prisma.asset.create({
        data: {
          projectId: character.projectId,
          kind: 'image',
          storageKey: '',
          contentType,
          meta: { role: 'character-ref', characterId: character.id, uploaded: true },
        },
      });
      const key = `${character.projectId}/${asset.id}.${ext}`;
      await getStorage().put(key, buf, contentType);
      await prisma.asset.update({ where: { id: asset.id }, data: { storageKey: key } });
      await prisma.character.update({ where: { id: character.id }, data: { refAssetId: asset.id } });
      return NextResponse.json({ assetId: asset.id });
    }

    // generate 模式：异步任务，worker 成功后回写 refAssetId
    const adapterId = body.adapterId ?? (await resolveAdapterId(character.projectId, 'image.character'));
    const adapter = getAdapter(adapterId);
    const input = {
      prompt:
        body.prompt ??
        `${character.name}，${character.description}。正面半身定妆照，中性表情，纯色背景，光线均匀，适合作为角色一致性参考图`,
      aspectRatio: '9:16',
      characterId: character.id,
    };
    const estimated = adapter.estimateCost(input);
    const job = await prisma.generationJob.create({
      data: {
        projectId: character.projectId,
        capability: 'image.character',
        adapterId,
        input,
        estimatedCostCents: estimated.cents,
        currency: estimated.currency,
      },
    });
    await getQueue(GENERATION_QUEUE).add('character-ref', { jobId: job.id });
    return NextResponse.json({ job }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}
