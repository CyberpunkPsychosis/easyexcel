import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** 工作台主数据：项目 + 集/场/镜树 + 每镜环节配置与变体 + 角色 + 项目级模型配置 */
export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(params.projectId, user.id, 'read');
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        characters: true,
        modelConfigs: true,
        episodes: {
          orderBy: { index: 'asc' },
          include: {
            scenes: {
              orderBy: { index: 'asc' },
              include: {
                shots: {
                  orderBy: { index: 'asc' },
                  include: {
                    stages: true,
                    variants: {
                      orderBy: { createdAt: 'desc' },
                      include: { asset: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    return NextResponse.json({ project });
  } catch (e) {
    return handleError(e);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  /** 广电备案号（合规卡点校验项） */
  registrationNo: z.string().max(60).nullable().optional(),
  /** 项目级切模型：{capability, adapterId} */
  modelConfig: z.object({ capability: z.string(), adapterId: z.string() }).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(params.projectId, user.id);
    const body = patchSchema.parse(await req.json());
    if (body.name || body.description || body.registrationNo !== undefined) {
      await prisma.project.update({
        where: { id: params.projectId },
        data: { name: body.name, description: body.description, registrationNo: body.registrationNo },
      });
    }
    if (body.modelConfig) {
      await prisma.modelConfig.upsert({
        where: {
          projectId_capability: {
            projectId: params.projectId,
            capability: body.modelConfig.capability,
          },
        },
        create: { projectId: params.projectId, ...body.modelConfig },
        update: { adapterId: body.modelConfig.adapterId },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
