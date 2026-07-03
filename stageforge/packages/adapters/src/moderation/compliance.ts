import Anthropic from '@anthropic-ai/sdk';

/**
 * 内容合规审核（M4 备案合规卡点的内容项）。
 * 背景（调研）：2026-04 起未备案 AI 漫剧一律下架；广电「AI 魔改」专项治理使
 * 审核成本 +15%。本审核用 LLM 预筛剧本台词的高风险内容，定位是**发布前的
 * 内部预检**，不替代平台/监管审核。无 ANTHROPIC_API_KEY 时返回空 findings（mock）。
 */
export interface ComplianceFinding {
  severity: 'block' | 'warn';
  quote: string;
  reason: string;
}

export interface ContentReviewResult {
  findings: ComplianceFinding[];
  mock: boolean;
}

export async function reviewShortDramaContent(text: string): Promise<ContentReviewResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { findings: [], mock: true };
  }
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: `你是短剧平台的内容预审员。审查下面的竖屏短剧台词是否存在发布风险：违法违规、
血腥暴力细节、色情低俗、侮辱诽谤、民族宗教歧视、伪科学误导、未成年人不宜等。
正常的剧情冲突（打脸、复仇、商战、误会）不算风险。只输出 JSON：
{"findings":[{"severity":"block|warn","quote":"原文片段","reason":"不超过30字"}]}
没有问题就输出 {"findings":[]}。

台词：
<lines>
${text.slice(0, 30000)}
</lines>`,
      },
    ],
  });
  if (msg.stop_reason === 'refusal') {
    return {
      findings: [{ severity: 'block', quote: '', reason: '审核模型拒绝处理该内容，请人工复核' }],
      mock: false,
    };
  }
  const out = msg.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const start = out.indexOf('{');
  const end = out.lastIndexOf('}');
  if (start < 0 || end <= start) return { findings: [], mock: false };
  const parsed = JSON.parse(out.slice(start, end + 1)) as { findings?: ComplianceFinding[] };
  return { findings: parsed.findings ?? [], mock: false };
}
