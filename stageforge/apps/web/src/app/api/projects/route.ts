import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@stageforge/db';
import { GENERATION_QUEUE, getQueue } from '@stageforge/core';
import { getAdapter } from '@stageforge/adapters';
import { requireUser } from '@/lib/auth';
import { handleError } from '@/lib/server';
import { resolveAdapterId } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

const DEFAULT_MODEL_CONFIG: Record<string, string> = {
  'text.script': 'claude-script',
  'text.storyboard': 'claude-storyboard',
  'text.translate': 'claude-translate',
  'image.t2i': 'jimeng-t2i',
  'image.character': 'jimeng-omniref',
  'video.i2v': 'seedance-2.0',
  'video.t2v': 'seedance-2.0-t2v',
  'audio.tts': 'elevenlabs-v3',
  'audio.voiceclone': 'elevenlabs-clone',
  'audio.lipsync': 'sync-so',
  'audio.music': 'suno-music',
  'audio.sfx': 'jimeng-sfx',
  'render.compose': 'internal-ffmpeg',
};

export async function GET() {
  try {
    const user = await requireUser();
    const projects = await prisma.project.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { episodes: true, characters: true } } },
    });
    return NextResponse.json({ projects });
  } catch (e) {
    return handleError(e);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  /** 可选：建项目时直接贴剧本，立即触发分镜拆解 */
  script: z.string().max(100_000).optional(),
  storyboardAdapterId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = createSchema.parse(await req.json());

    const project = await prisma.project.create({
      data: { name: body.name, description: body.description, ownerId: user.id },
    });
    await prisma.modelConfig.createMany({
      data: Object.entries(DEFAULT_MODEL_CONFIG).map(([capability, adapterId]) => ({
        projectId: project.id,
        capability,
        adapterId,
      })),
    });

    let jobId: string | null = null;
    if (body.script?.trim()) {
      const adapterId =
        body.storyboardAdapterId ?? (await resolveAdapterId(project.id, 'text.storyboard'));
      const adapter = getAdapter(adapterId);
      const input = { script: body.script, characterNames: [] };
      const estimated = adapter.estimateCost(input);
      const job = await prisma.generationJob.create({
        data: {
          projectId: project.id,
          capability: 'text.storyboard',
          adapterId,
          input,
          estimatedCostCents: estimated.cents,
          currency: estimated.currency,
        },
      });
      await getQueue(GENERATION_QUEUE).add('storyboard', { jobId: job.id });
      jobId = job.id;
    }

    return NextResponse.json({ project, storyboardJobId: jobId }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
