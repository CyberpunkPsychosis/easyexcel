import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1).max(40),
  description: z.string().max(300).optional(),
  consistencyNote: z.string().max(200).optional(),
});

/** 新建角色（跨镜头一致性实体） */
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(params.projectId, user.id);
    const body = createSchema.parse(await req.json());
    const character = await prisma.character.create({
      data: {
        projectId: params.projectId,
        name: body.name,
        description: body.description ?? '',
        ...(body.consistencyNote ? { consistencyNote: body.consistencyNote } : {}),
      },
    });
    return NextResponse.json({ character }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
