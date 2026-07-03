import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { tryGetAdapter } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { badRequest, getShotWithAccess, handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  capability: z.string(),
  /** null = 清除单镜覆盖，回落项目默认 */
  adapterId: z.string().nullable(),
});

/** 单镜切模型：改 ShotStage.adapterId —— 整个平台「任意环节任意模型」的写路径就这一处 */
export async function PATCH(req: NextRequest, { params }: { params: { shotId: string } }) {
  try {
    const user = await requireUser();
    await getShotWithAccess(params.shotId, user.id);
    const body = schema.parse(await req.json());
    if (body.adapterId !== null) {
      const adapter = tryGetAdapter(body.adapterId);
      if (!adapter) badRequest(`未知适配器: ${body.adapterId}`);
      if (adapter.capability !== body.capability) {
        badRequest(`适配器 ${body.adapterId} 属于 ${adapter.capability}，不能用于 ${body.capability}`);
      }
    }
    const stage = await prisma.shotStage.upsert({
      where: { shotId_capability: { shotId: params.shotId, capability: body.capability } },
      create: { shotId: params.shotId, capability: body.capability, adapterId: body.adapterId },
      update: { adapterId: body.adapterId },
    });
    return NextResponse.json({ stage });
  } catch (e) {
    return handleError(e);
  }
}
