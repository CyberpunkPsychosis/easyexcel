import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { getStorage } from '@stageforge/core';
import { scoreCharacterConsistency } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, badRequest, handleError, notFound } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * 一致性检测：关键帧变体 vs 镜头首个有参考图的角色（Claude 视觉裁判）。
 * 分数写入 asset.meta.consistency，低分变体在变体带上直接可见 → 快速筛掉跳脸。
 */
export async function POST(_req: NextRequest, { params }: { params: { variantId: string } }) {
  try {
    const user = await requireUser();
    const variant = await prisma.variant.findUnique({
      where: { id: params.variantId },
      include: { asset: true, shot: { include: { scene: { include: { episode: true } } } } },
    });
    if (!variant) notFound('变体不存在');
    await assertProjectAccess(variant.shot.scene.episode.projectId, user.id);
    if (!variant.asset.contentType.startsWith('image/')) {
      badRequest('一致性检测目前只支持图像变体（关键帧）');
    }

    const characters = await prisma.character.findMany({
      where: { id: { in: variant.shot.characterIds } },
    });
    const anchor = characters.find((c) => c.refAssetId);
    if (!anchor?.refAssetId) badRequest('该镜头的角色都没有参考图，先去角色库生成/上传定妆照');
    const refAsset = await prisma.asset.findUnique({ where: { id: anchor.refAssetId } });
    if (!refAsset?.storageKey) badRequest('角色参考图资产缺失');

    const storage = getStorage();
    const [refBuf, candBuf] = await Promise.all([
      storage.get(refAsset.storageKey),
      storage.get(variant.asset.storageKey),
    ]);
    const result = await scoreCharacterConsistency(
      anchor.name,
      { data: refBuf, contentType: refAsset.contentType },
      { data: candBuf, contentType: variant.asset.contentType },
    );

    await prisma.asset.update({
      where: { id: variant.assetId },
      data: {
        meta: {
          ...(variant.asset.meta as Record<string, unknown>),
          consistency: { ...result, characterName: anchor.name, at: new Date().toISOString() },
        },
      },
    });
    return NextResponse.json({ result, characterName: anchor.name });
  } catch (e) {
    return handleError(e);
  }
}
