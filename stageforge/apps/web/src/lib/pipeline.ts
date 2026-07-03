import {
  clampDuration,
  listAdapters,
  tryGetAdapter,
} from '@stageforge/adapters';
import type {
  Capability,
  CharacterRef,
  I2VInput,
  LipsyncInput,
  T2IInput,
  TTSInput,
} from '@stageforge/core';
import { prisma, type Prisma, type Shot, type ShotStage, type Variant, type Asset } from '@stageforge/db';
import { badRequest } from './server';

type ShotWithRelations = Shot & {
  stages: ShotStage[];
  variants: (Variant & { asset: Asset })[];
};

/**
 * 解析某个镜头某个环节实际使用的 adapterId。
 * 优先级：单镜覆盖（ShotStage.adapterId）→ 项目默认（ModelConfig）→ 注册表首个。
 * 「任意环节任意模型」的读路径就这三行查表，没有任何模型硬编码。
 */
export async function resolveAdapterId(
  projectId: string,
  capability: Capability,
  stages?: ShotStage[],
): Promise<string> {
  const override = stages?.find((s) => s.capability === capability)?.adapterId;
  if (override && tryGetAdapter(override)) return override;
  const config = await prisma.modelConfig.findUnique({
    where: { projectId_capability: { projectId, capability } },
  });
  if (config && tryGetAdapter(config.adapterId)) return config.adapterId;
  const first = listAdapters(capability)[0];
  if (!first) badRequest(`没有任何适配器支持能力 ${capability}`);
  return first.id;
}

async function characterRefsFor(shot: Shot): Promise<CharacterRef[]> {
  if (shot.characterIds.length === 0) return [];
  const characters = await prisma.character.findMany({ where: { id: { in: shot.characterIds } } });
  return characters.map((c) => ({
    characterId: c.id,
    name: c.name,
    refAssetId: c.refAssetId,
    consistencyNote: c.consistencyNote,
  }));
}

function selectedVariant(shot: ShotWithRelations, capabilities: Capability[]) {
  return shot.variants.find((v) => v.selected && capabilities.includes(v.capability as Capability));
}

/**
 * 按能力从镜头数据组装 adapter 输入。
 * 角色参考图/一致性话术在这里统一注入 —— 模型无关（只有声明
 * supportsReferenceImage 的适配器会消费 characterRefs，其余自动忽略）。
 */
export async function buildStageInput(
  capability: Capability,
  shot: ShotWithRelations,
): Promise<Prisma.InputJsonValue> {
  const refs = await characterRefsFor(shot);
  const consistency = refs.length > 0 ? `。${refs.map((r) => `@${r.name} ${r.consistencyNote}`).join('；')}` : '';

  switch (capability) {
    case 'image.t2i':
    case 'image.character': {
      const input: T2IInput = {
        prompt: `${shot.visualPrompt}${consistency}`,
        aspectRatio: '9:16',
        characterRefs: refs,
      };
      return input as unknown as Prisma.InputJsonValue;
    }
    case 'video.i2v':
    case 'video.t2v': {
      const keyframe = selectedVariant(shot, ['image.t2i']);
      const input: I2VInput = {
        prompt: `${shot.visualPrompt}，${shot.cameraMove}镜头，${shot.emotion}情绪${consistency}`,
        durationSec: clampDuration(shot.durationSec),
        resolution: '1080p',
        aspectRatio: '9:16',
        keyframeAssetId: capability === 'video.i2v' ? keyframe?.assetId ?? null : null,
        dialogue: shot.dialogue,
        characterRefs: refs,
      };
      return input as unknown as Prisma.InputJsonValue;
    }
    case 'audio.tts': {
      if (!shot.dialogue.trim()) badRequest('该镜头没有台词，无法配音');
      const input: TTSInput = { text: shot.dialogue };
      return input as unknown as Prisma.InputJsonValue;
    }
    case 'audio.lipsync': {
      const video = selectedVariant(shot, ['video.i2v', 'video.t2v']);
      const audio = selectedVariant(shot, ['audio.tts', 'audio.voiceclone']);
      if (!video) badRequest('请先生成并选定该镜头的视频变体');
      if (!audio) badRequest('请先生成并选定该镜头的配音变体');
      const input: LipsyncInput = { videoAssetId: video.assetId, audioAssetId: audio.assetId };
      return input as unknown as Prisma.InputJsonValue;
    }
    default:
      badRequest(`能力 ${capability} 不支持镜头级生成`);
  }
}
