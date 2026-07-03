import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  SHOT_STAGES,
  getStorage,
  mockStoryboardFromScript,
  svgPlaceholder,
} from '@stageforge/core';

const prisma = new PrismaClient();

const SAMPLE_SCRIPT = `雨夜，林晚抱着刚被裁员的纸箱走出写字楼，手机弹出一条消息：她的未婚夫顾沉舟，正在隔壁酒店举办订婚宴，新娘不是她。
林晚推开宴会厅大门，全场安静。顾沉舟举着香槟的手停在半空。
"抱歉，打扰了。"林晚笑着摘下婚戒，扔进香槟塔，"这场戏，我不陪了。"
三个月后，林晚以新任集团总裁的身份，出现在顾氏的并购谈判桌对面。
顾沉舟看着签字页上"林晚"两个字，指节发白："你到底是谁？"
林晚合上钢笔，抬眼："顾总，现在，轮到我出题了。"`;

/** 项目级各能力默认适配器 —— seed 与 registry id 保持一致 */
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

async function main() {
  const storage = getStorage();

  const passwordHash = await bcrypt.hash('stageforge', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@stageforge.dev' },
    update: {},
    create: { email: 'demo@stageforge.dev', name: 'Demo 制片人', passwordHash },
  });

  const existing = await prisma.project.findFirst({ where: { ownerId: user.id } });
  if (existing) {
    console.log('seed: demo project already exists, skipping');
    return;
  }

  const project = await prisma.project.create({
    data: {
      name: '示例 · 重生之她掀了牌桌',
      description: '竖屏 9:16 都市逆袭微短剧（seed 示例项目）',
      ownerId: user.id,
    },
  });

  await prisma.modelConfig.createMany({
    data: Object.entries(DEFAULT_MODEL_CONFIG).map(([capability, adapterId]) => ({
      projectId: project.id,
      capability,
      adapterId,
    })),
  });

  // 角色 + 参考图资产（正面中性表情锚图）
  const characterSpecs = [
    { name: '林晚', description: '女主，28岁，外柔内刚，职场逆袭', hue: 340 },
    { name: '顾沉舟', description: '男主，32岁，集团继承人，深沉隐忍', hue: 215 },
  ];
  const characterIdByName = new Map<string, string>();
  for (const spec of characterSpecs) {
    const asset = await prisma.asset.create({
      data: {
        projectId: project.id,
        kind: 'image',
        storageKey: '',
        contentType: 'image/svg+xml',
        meta: { role: 'character-ref', name: spec.name },
      },
    });
    const key = `${project.id}/${asset.id}.svg`;
    await storage.put(
      key,
      Buffer.from(
        svgPlaceholder({
          title: spec.name,
          subtitle: '角色参考图 · 正面 · 中性表情',
          badge: 'character-ref',
          hue: spec.hue,
        }),
      ),
      'image/svg+xml',
    );
    await prisma.asset.update({ where: { id: asset.id }, data: { storageKey: key } });
    const character = await prisma.character.create({
      data: {
        projectId: project.id,
        name: spec.name,
        description: spec.description,
        refAssetId: asset.id,
      },
    });
    characterIdByName.set(spec.name, character.id);
  }

  // 用确定性 mock 分镜器把示例剧本落成 集/场/镜
  const storyboard = mockStoryboardFromScript(SAMPLE_SCRIPT, ['林晚', '顾沉舟']);
  for (const [ei, ep] of storyboard.episodes.entries()) {
    const episode = await prisma.episode.create({
      data: { projectId: project.id, index: ei, title: ep.title },
    });
    for (const [si, scene] of ep.scenes.entries()) {
      const sceneRow = await prisma.scene.create({
        data: { episodeId: episode.id, index: si, title: scene.title, location: scene.location },
      });
      for (const [shi, shot] of scene.shots.entries()) {
        const shotRow = await prisma.shot.create({
          data: {
            sceneId: sceneRow.id,
            index: shi,
            dialogue: shot.dialogue,
            visualPrompt: shot.visualPrompt,
            shotType: shot.shotType,
            emotion: shot.emotion,
            cameraMove: shot.cameraMove,
            durationSec: shot.durationSec,
            characterIds: shot.characters
              .map((n) => characterIdByName.get(n))
              .filter((id): id is string => Boolean(id)),
          },
        });
        await prisma.shotStage.createMany({
          data: SHOT_STAGES.map((capability) => ({
            shotId: shotRow.id,
            capability,
            adapterId: null, // null = 跟随项目 ModelConfig 默认；单镜切模型改这里
          })),
        });
      }
    }
  }

  console.log('seed 完成 ✓');
  console.log('  登录: demo@stageforge.dev / stageforge');
  console.log(`  示例项目: ${project.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
