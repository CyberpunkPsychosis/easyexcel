import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { SHOT_STAGES } from '@stageforge/core';
import { requireUser } from '@/lib/auth';
import { badRequest, getShotWithAccess, handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * 「拆正反打」一键回退（调研附录 A.2 第 6 条，产品化而非文档提示）：
 * 双人对手戏锁脸失败时，把多人镜头拆成 N 个单人镜头交叉剪辑，
 * 每段只出一个人脸，一致性更可控。
 */
export async function POST(_req: NextRequest, { params }: { params: { shotId: string } }) {
  try {
    const user = await requireUser();
    const { shot } = await getShotWithAccess(params.shotId, user.id);
    if (shot.characterIds.length < 2) {
      badRequest('该镜头出场角色少于 2 人，无需拆正反打');
    }

    const characters = await prisma.character.findMany({ where: { id: { in: shot.characterIds } } });
    const nameById = new Map(characters.map((c) => [c.id, c.name]));
    const [first, ...rest] = shot.characterIds;

    await prisma.$transaction(async (tx) => {
      // 后续镜头顺移，给新插入的 (n-1) 个反打镜头腾位
      await tx.shot.updateMany({
        where: { sceneId: shot.sceneId, index: { gt: shot.index } },
        data: { index: { increment: rest.length } },
      });
      // 原镜头改为第一个角色的单人正打
      await tx.shot.update({
        where: { id: shot.id },
        data: {
          characterIds: [first],
          visualPrompt: `${shot.visualPrompt}。单人正打：只出现${nameById.get(first) ?? '角色A'}，对话对象画外`,
        },
      });
      // 其余角色各插入一个单人反打镜头
      for (const [i, charId] of rest.entries()) {
        const newShot = await tx.shot.create({
          data: {
            sceneId: shot.sceneId,
            index: shot.index + 1 + i,
            dialogue: '',
            visualPrompt: `${shot.visualPrompt}。单人反打：只出现${nameById.get(charId) ?? '角色B'}，视线朝向画外对话对象`,
            shotType: shot.shotType,
            emotion: shot.emotion,
            cameraMove: shot.cameraMove,
            durationSec: shot.durationSec,
            characterIds: [charId],
          },
        });
        await tx.shotStage.createMany({
          data: SHOT_STAGES.map((capability) => ({ shotId: newShot.id, capability, adapterId: null })),
        });
      }
    });

    return NextResponse.json({ ok: true, added: rest.length });
  } catch (e) {
    return handleError(e);
  }
}
