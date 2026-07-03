import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';

export const dynamic = 'force-dynamic';

async function getCharacterWithAccess(characterId: string, userId: string) {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) notFound('角色不存在');
  await assertProjectAccess(character.projectId, userId);
  return character;
}

const patchSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  description: z.string().max(300).optional(),
  consistencyNote: z.string().max(200).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { characterId: string } }) {
  try {
    const user = await requireUser();
    await getCharacterWithAccess(params.characterId, user.id);
    const body = patchSchema.parse(await req.json());
    const character = await prisma.character.update({ where: { id: params.characterId }, data: body });
    return NextResponse.json({ character });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { characterId: string } }) {
  try {
    const user = await requireUser();
    await getCharacterWithAccess(params.characterId, user.id);
    await prisma.character.delete({ where: { id: params.characterId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
