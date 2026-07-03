import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const user = await requireUser();
    const job = await prisma.generationJob.findUnique({ where: { id: params.jobId } });
    if (!job) notFound('任务不存在');
    await assertProjectAccess(job.projectId, user.id, 'read');
    return NextResponse.json({ job });
  } catch (e) {
    return handleError(e);
  }
}
