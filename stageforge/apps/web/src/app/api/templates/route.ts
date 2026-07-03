import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { handleError } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** 模板市场：内置爆款结构 + 自己发布的模板 */
export async function GET() {
  try {
    const user = await requireUser();
    const templates = await prisma.template.findMany({
      where: { OR: [{ builtIn: true }, { authorId: user.id }] },
      orderBy: [{ builtIn: 'desc' }, { usedCount: 'desc' }],
    });
    return NextResponse.json({ templates });
  } catch (e) {
    return handleError(e);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  genre: z.string().max(30).optional(),
  guidance: z.string().min(10).max(4000),
});

/** 发布自己的模板（跑通的爆款结构沉淀复用） */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await req.json());
    const template = await prisma.template.create({
      data: {
        name: body.name,
        description: body.description ?? '',
        genre: body.genre ?? '',
        guidance: body.guidance,
        authorId: user.id,
      },
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
