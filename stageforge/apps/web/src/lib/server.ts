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

export type AccessMode = 'read' | 'write';

/**
 * 团队协作权限（M4）：owner 全权；member editor 可读写；member viewer 只读。
 * 默认 'write' —— 忘了标注的变更类路由天然拿最严权限。
 */
export async function assertProjectAccess(projectId: string, userId: string, mode: AccessMode = 'write') {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound('项目不存在');
  if (project.ownerId === userId) return project;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw Object.assign(new Error('forbidden'), { status: 403 });
  if (mode === 'write' && member.role === 'viewer') {
    throw Object.assign(new Error('只读成员无法执行此操作'), { status: 403 });
  }
  return project;
}

/** 服务端页面用：能否访问（含协作成员） */
export async function canAccessProject(projectId: string, userId: string): Promise<boolean> {
  try {
    await assertProjectAccess(projectId, userId, 'read');
    return true;
  } catch {
    return false;
  }
}

/** 通过 shot 反查项目并校验归属 */
export async function getShotWithAccess(shotId: string, userId: string, mode: AccessMode = 'write') {
  const shot = await prisma.shot.findUnique({
    where: { id: shotId },
    include: {
      scene: { include: { episode: true } },
      stages: true,
      variants: { include: { asset: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!shot) notFound('镜头不存在');
  const project = await assertProjectAccess(shot.scene.episode.projectId, userId, mode);
  return { shot, project };
}
