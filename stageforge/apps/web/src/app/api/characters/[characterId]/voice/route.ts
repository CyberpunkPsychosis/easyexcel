import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { getStorage } from '@stageforge/core';
import { cloneVoiceElevenLabs } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, badRequest, handleError, notFound } from '@/lib/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  /** data:audio/*;base64,… 样音（调研：1 分钟高质量样音足够） */
  dataUrl: z.string().max(16_000_000),
});

/**
 * 声音克隆建库：上传角色样音 → 建克隆音色 → 回写 Character.voiceId。
 * 之后该角色的台词 TTS 自动使用专属音色（pipeline 注入 voiceId）。
 */
export async function POST(req: NextRequest, { params }: { params: { characterId: string } }) {
  try {
    const user = await requireUser();
    const character = await prisma.character.findUnique({ where: { id: params.characterId } });
    if (!character) notFound('角色不存在');
    await assertProjectAccess(character.projectId, user.id);
    const body = schema.parse(await req.json());

    const match = /^data:(audio\/[a-z0-9+.-]+);base64,(.+)$/.exec(body.dataUrl);
    if (!match) badRequest('dataUrl 格式不合法（需 data:audio/*;base64,…）');
    const [, contentType, b64] = match;
    const buf = Buffer.from(b64, 'base64');

    // 样音落资产（留档，便于换供应商时重克隆）
    const ext = contentType.includes('wav') ? 'wav' : contentType.includes('ogg') ? 'ogg' : 'mp3';
    const asset = await prisma.asset.create({
      data: {
        projectId: character.projectId,
        kind: 'audio',
        storageKey: '',
        contentType,
        meta: { role: 'voice-sample', characterId: character.id },
      },
    });
    const key = `${character.projectId}/${asset.id}.${ext}`;
    await getStorage().put(key, buf, contentType);
    await prisma.asset.update({ where: { id: asset.id }, data: { storageKey: key } });

    const { voiceId, mock } = await cloneVoiceElevenLabs(
      `sf-${character.projectId.slice(-6)}-${character.name}`,
      { data: buf, contentType },
    );
    await prisma.character.update({
      where: { id: character.id },
      data: { voiceId, voiceSampleAssetId: asset.id },
    });
    return NextResponse.json({ voiceId, mock });
  } catch (e) {
    return handleError(e);
  }
}
