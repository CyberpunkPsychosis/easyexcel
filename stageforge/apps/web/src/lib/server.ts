import { NextResponse } from 'next/server';
import { prisma } from '@stageforge/db';

/** 统一的 route handler 错误包装 */
export function handleError(e: unknown): NextResponse {
  const status = (e as { status?: number }).status ?? 500;
  const message = e instanceof Error ? e.message : String(e);
  if (status >= 500) console.error('api error:', e);
  return NextResponse.json({ error: message }, { status });
}

export function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

export function notFound(message = 'not found'): never {
  throw Object.assign(new Error(message), { status: 404 });
}

export async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound('项目不存在');
  if (project.ownerId !== userId) throw Object.assign(new Error('forbidden'), { status: 403 });
  return project;
}

/** 通过 shot 反查项目并校验归属 */
export async function getShotWithAccess(shotId: string, userId: string) {
  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    include: {
      scene: { include: { episode: true } },
      stages: true,
      variants: { include: { asset: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!shot) notFound('镜头不存在');
  const project = await assertProjectAccess(shot.scene.episode.projectId, userId);
  return { shot, project };
}
