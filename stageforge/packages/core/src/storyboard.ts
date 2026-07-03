import { z } from 'zod';

/**
 * 分镜表结构 —— text.storyboard 能力的结构化输出契约。
 * 所有 LLM 适配器（Claude/GPT/DeepSeek/Gemini）都必须产出符合此 schema 的 JSON。
 */
export const shotSchema = z.object({
  dialogue: z.string().default(''),
  visualPrompt: z.string(),
  shotType: z.string().default('中景'), // 景别：特写/近景/中景/全景
  emotion: z.string().default('平静'),
  cameraMove: z.string().default('固定'),
  durationSec: z.number().min(1).max(15).default(5),
  characters: z.array(z.string()).default([]),
});

export const sceneSchema = z.object({
  title: z.string(),
  location: z.string().default(''),
  shots: z.array(shotSchema).min(1),
});

export const episodeSchema = z.object({
  title: z.string(),
  scenes: z.array(sceneSchema).min(1),
});

export const storyboardSchema = z.object({
  episodes: z.array(episodeSchema).min(1),
});

export type Storyboard = z.infer<typeof storyboardSchema>;
export type StoryboardShot = z.infer<typeof shotSchema>;

export interface StoryboardOutput {
  storyboard: Storyboard;
}

/**
 * 构建给 LLM 的分镜拆解提示词。
 * 强制要求首镜 2 秒强钩子 —— 调研核验：2 秒开场钩子留存 +19%，是完播率关键变量（附录 A.4）。
 */
export function buildStoryboardPrompt(script: string, characterNames: string[] = [], guidance = ''): string {
  return [
    '你是资深竖屏微短剧导演。把下面的剧本拆解为可直接投产的分镜表。',
    '',
    '硬性要求：',
    '1. 每一集的第一个镜头必须是 2 秒内抓住观众的强钩子（冲突/悬念/反转直给）。',
    '2. 每个镜头 durationSec 在 3-15 秒之间（视频模型单段上限 15 秒）。',
    '3. visualPrompt 用于图像/视频生成：写清人物、动作、场景、光线、镜头语言，不要写台词。',
    '4. dialogue 是该镜头的台词/旁白，没有就留空字符串。',
    '5. 竖屏 9:16 构图思维：人物为主，特写和近景占比高。',
    characterNames.length > 0
      ? `6. 出场角色名必须从这个列表里选（保持一致性）：${characterNames.join('、')}。`
      : '6. characters 数组填该镜头出场的角色名。',
    guidance ? `补充要求：${guidance}` : '',
    '',
    '只输出一个 JSON 对象，不要任何解释、不要 markdown 代码块。结构：',
    '{"episodes":[{"title":"第1集 ...","scenes":[{"title":"场景名","location":"地点","shots":[{"dialogue":"","visualPrompt":"","shotType":"特写|近景|中景|全景","emotion":"","cameraMove":"固定|推|拉|摇|移","durationSec":5,"characters":["角色名"]}]}]}]}',
    '',
    '剧本：',
    '<script>',
    script,
    '</script>',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 从 LLM 回复里稳健地抠出 JSON（容忍代码块围栏/前后杂讯） */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('LLM 输出中未找到 JSON 对象');
  return JSON.parse(trimmed.slice(start, end + 1));
}

const SHOT_TYPES = ['特写', '近景', '中景', '全景'];
const EMOTIONS = ['紧张', '愤怒', '隐忍', '得意', '悲伤', '坚定'];
const MOVES = ['固定', '缓推', '拉远', '横移'];

/**
 * 确定性 mock 分镜生成器：无 API key 时保证全流程可 demo。
 * 把剧本按段落切成镜头，每 3 镜一场、每 2 场一集。
 */
export function mockStoryboardFromScript(script: string, characterNames: string[] = []): Storyboard {
  const paragraphs = script
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, 48);
  const chunks = paragraphs.length > 0 ? paragraphs : ['开场：一场足以颠覆主角命运的意外，正面撞进观众眼睛。'];

  const shots = chunks.map((p, i) => ({
    dialogue: p.length > 42 ? `${p.slice(0, 40)}……` : p,
    visualPrompt: `竖屏9:16，${SHOT_TYPES[i % SHOT_TYPES.length]}，${
      characterNames[i % Math.max(characterNames.length, 1)] ?? '主角'
    }，${EMOTIONS[i % EMOTIONS.length]}的情绪，电影感打光，${i === 0 ? '开场2秒强钩子，冲突直给，' : ''}画面信息密度高`,
    shotType: SHOT_TYPES[i % SHOT_TYPES.length],
    emotion: EMOTIONS[i % EMOTIONS.length],
    cameraMove: MOVES[i % MOVES.length],
    durationSec: 5,
    characters: characterNames.length > 0 ? [characterNames[i % characterNames.length]] : [],
  }));

  const scenes = [] as { title: string; location: string; shots: typeof shots }[];
  for (let i = 0; i < shots.length; i += 3) {
    scenes.push({
      title: `场景 ${scenes.length + 1}`,
      location: scenes.length % 2 === 0 ? '室内' : '室外',
      shots: shots.slice(i, i + 3),
    });
  }

  const episodes = [] as Storyboard['episodes'];
  for (let i = 0; i < scenes.length; i += 2) {
    episodes.push({
      title: `第${episodes.length + 1}集`,
      scenes: scenes.slice(i, i + 2),
    });
  }

  return storyboardSchema.parse({ episodes });
}
