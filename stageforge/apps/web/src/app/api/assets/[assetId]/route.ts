import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@stageforge/db';
import { getStorage } from '@stageforge/core';
import { requireUser } from '@/lib/auth';
import { assertProjectAccess, handleError, notFound } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** 资产出口：local 驱动直接流式返回；s3 驱动 302 到预签名 URL */
export async function GET(_req: NextRequest, { params }: { params: { assetId: string } }) {
  try {
    const user = await requireUser();
    const asset = await prisma.asset.findUnique({ where: { id: params.assetId } });
    if (!asset || !asset.storageKey) notFound('资产不存在');
    await assertProjectAccess(asset.projectId, user.id, 'read');

    const storage = getStorage();
    const presigned = await storage.presignedUrl(asset.storageKey);
    if (presigned) return NextResponse.redirect(presigned);

    const buf = await storage.get(asset.storageKey);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': asset.contentType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': String(buf.length),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
