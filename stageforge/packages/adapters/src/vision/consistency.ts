import Anthropic from '@anthropic-ai/sdk';

/**
 * 角色一致性打分（M3）：Claude 视觉当裁判 —— 对比「角色参考图」与「生成关键帧」，
 * 给出人脸/发型/服装一致性 0-100 分与整改建议。
 *
 * 设计说明：调研（附录 A.2）明确「95% 一致性」这类绝对数字不可靠，因此本功能
 * 定位为**相对参考**：帮创作者快速筛掉明显跳脸的变体，分数不作为承诺指标。
 * 无 ANTHROPIC_API_KEY 或图片为 SVG 占位（mock 资产）时返回确定性 mock 分。
 */
export interface ConsistencyResult {
  score: number; // 0-100
  notes: string;
  mock: boolean;
}

const VISION_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type VisionType = (typeof VISION_TYPES)[number];

function isVisionType(t: string): t is VisionType {
  return (VISION_TYPES as readonly string[]).includes(t);
}

function mockScore(seedA: Buffer, seedB: Buffer): ConsistencyResult {
  // 确定性伪分：同一对图片永远同分，便于 demo 与测试
  const h = (seedA.length * 31 + seedB.length * 17) % 18;
  return {
    score: 78 + h,
    notes: 'mock 评分（无 ANTHROPIC_API_KEY 或占位图为 SVG）。接入真实图像模型后自动启用视觉裁判。',
    mock: true,
  };
}

export async function scoreCharacterConsistency(
  characterName: string,
  ref: { data: Buffer; contentType: string },
  candidate: { data: Buffer; contentType: string },
): Promise<ConsistencyResult> {
  if (
    !process.env.ANTHROPIC_API_KEY ||
    !isVisionType(ref.contentType) ||
    !isVisionType(candidate.contentType)
  ) {
    return mockScore(ref.data, candidate.data);
  }

  const client = new Anthropic();
  const msg = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 600,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: ref.contentType, data: ref.data.toString('base64') },
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: candidate.contentType as VisionType,
              data: candidate.data.toString('base64'),
            },
          },
          {
            type: 'text',
            text: `第一张是短剧角色「${characterName}」的定妆参考图，第二张是 AI 生成的分镜关键帧。请评估第二张里该角色与参考图的一致性（脸部特征、发型、服装各占权重），只输出 JSON：{"score": 0到100的整数, "notes": "不超过60字的差异说明与整改建议"}`,
          },
        ],
      },
    ],
  });
  if (msg.stop_reason === 'refusal') {
    return { score: 0, notes: '视觉裁判拒绝了该请求，请检查图片内容', mock: false };
  }
  const text = msg.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return { score: 0, notes: `裁判输出无法解析：${text.slice(0, 80)}`, mock: false };
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { score?: number; notes?: string };
  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
    notes: String(parsed.notes ?? '').slice(0, 200),
    mock: false,
  };
}
