import Anthropic from '@anthropic-ai/sdk';
import {
  buildStoryboardPrompt,
  computeCostCents,
  extractJson,
  mockStoryboardFromScript,
  storyboardSchema,
  type Credits,
  type ModelAdapter,
  type ScriptInput,
  type ScriptOutput,
  type StoryboardInput,
  type StoryboardOutput,
  type TranslateInput,
  type TranslateOutput,
  type Usage,
} from '@stageforge/core';

/**
 * Claude（Anthropic）—— M1 唯一的真实可跑适配器。
 * 调研核验：创作者横评 DeepSeek/GPT/Claude/Gemini 后，普遍认为 Claude
 * 在剧情与分镜拆解上表现最好（附录 A / 调研正文）。
 *
 * 无 ANTHROPIC_API_KEY 时自动降级为确定性 mock，保证 demo 不断链。
 */
const MODEL = 'claude-opus-4-8';

// Opus 4.8: $5 / $25 per MTok → 每 1k token 0.005 / 0.025 USD
const CLAUDE_COST = { unit: 'per_1k_token', input: 0.005, output: 0.025, currency: 'USD' } as const;

function hasKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function callClaude(prompt: string, maxTokens: number): Promise<{ text: string; usage: Usage }> {
  const client = new Anthropic();
  // 长输入（10 万字剧本）+ 长输出 → 流式，避免 HTTP 超时；adaptive thinking
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') {
    throw new Error('Claude 拒绝了该请求（safety refusal），请调整剧本内容后重试');
  }
  const text = msg.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return {
    text,
    usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
  };
}

function estimateLlmCost(inputChars: number, expectedOutputTokens: number): Credits {
  // 中文约 1 字 ≈ 1 token 量级的粗估，UI 标注为估算值
  return computeCostCents(CLAUDE_COST, {
    inputTokens: Math.ceil(inputChars),
    outputTokens: expectedOutputTokens,
  });
}

export const claudeStoryboard: ModelAdapter<StoryboardInput, StoryboardOutput> = {
  id: 'claude-storyboard',
  capability: 'text.storyboard',
  displayName: 'Claude（分镜拆解）',
  provider: 'Anthropic',
  region: 'global',
  caps: { async: false },
  cost: CLAUDE_COST,
  mock: false,
  notes: '创作者横评中剧情/分镜拆解表现最佳；无 key 自动降级 mock',
  confidence: 'verified',
  estimateCost(input) {
    return estimateLlmCost(input.script.length, Math.min(32000, input.script.length));
  },
  async submit(input, ctx) {
    if (!hasKey()) {
      ctx.log('claude-storyboard: 无 ANTHROPIC_API_KEY，使用确定性 mock 分镜');
      const storyboard = mockStoryboardFromScript(input.script, input.characterNames ?? []);
      return { externalId: `mock:${ctx.jobId}`, data: { output: { storyboard }, usage: {} } };
    }
    const prompt = buildStoryboardPrompt(input.script, input.characterNames ?? [], input.guidance ?? '');
    const first = await callClaude(prompt, 64000);
    let usage = first.usage;
    let parsed: StoryboardOutput['storyboard'];
    try {
      parsed = storyboardSchema.parse(extractJson(first.text));
    } catch (e) {
      // 结构不合规 → 带错误信息重试一次（结构化输出的轻量兜底）
      ctx.log(`claude-storyboard: 首次输出解析失败，纠错重试（${String(e).slice(0, 120)}）`);
      const retry = await callClaude(
        `${prompt}\n\n你上一次的输出无法解析为合法 JSON（错误：${String(e).slice(0, 200)}）。请严格只输出符合上述结构的 JSON 对象。`,
        64000,
      );
      parsed = storyboardSchema.parse(extractJson(retry.text));
      usage = {
        inputTokens: (usage.inputTokens ?? 0) + (retry.usage.inputTokens ?? 0),
        outputTokens: (usage.outputTokens ?? 0) + (retry.usage.outputTokens ?? 0),
      };
    }
    return { externalId: `claude:${ctx.jobId}`, data: { output: { storyboard: parsed }, usage } };
  },
  async poll(handle) {
    const d = handle.data as { output: StoryboardOutput; usage: Usage };
    return { state: 'succeeded', output: d.output, usage: d.usage };
  },
};

export const claudeScript: ModelAdapter<ScriptInput, ScriptOutput> = {
  id: 'claude-script',
  capability: 'text.script',
  displayName: 'Claude（剧本生成）',
  provider: 'Anthropic',
  region: 'global',
  caps: { async: false },
  cost: CLAUDE_COST,
  mock: false,
  confidence: 'verified',
  estimateCost(input) {
    return estimateLlmCost(input.prompt.length, 8000);
  },
  async submit(input, ctx) {
    if (!hasKey()) {
      ctx.log('claude-script: 无 ANTHROPIC_API_KEY，返回模板剧本');
      return {
        externalId: `mock:${ctx.jobId}`,
        data: {
          output: {
            text: `（mock 剧本）根据题材「${input.prompt.slice(0, 40)}」生成的示例剧本。\n第一场：开场 2 秒强钩子。\n第二场：冲突升级。\n第三场：反转收束，留下一集钩子。`,
          },
          usage: {},
        },
      };
    }
    const { text, usage } = await callClaude(
      `你是竖屏微短剧编剧。${input.guidance ?? ''}\n按以下要求写剧本（每集开场 2 秒强钩子、节奏快、台词短）：\n${input.prompt}`,
      32000,
    );
    return { externalId: `claude:${ctx.jobId}`, data: { output: { text }, usage } };
  },
  async poll(handle) {
    const d = handle.data as { output: ScriptOutput; usage: Usage };
    return { state: 'succeeded', output: d.output, usage: d.usage };
  },
};

export const claudeTranslate: ModelAdapter<TranslateInput, TranslateOutput> = {
  id: 'claude-translate',
  capability: 'text.translate',
  displayName: 'Claude（台词翻译）',
  provider: 'Anthropic',
  region: 'global',
  caps: { async: false },
  cost: CLAUDE_COST,
  mock: false,
  notes: '出海本地化性价比极高：AI 译制可把 100 集译期压到 12 小时内（附录 A.4）',
  confidence: 'verified',
  estimateCost(input) {
    return estimateLlmCost(input.text.length, input.text.length);
  },
  async submit(input, ctx) {
    if (!hasKey()) {
      return {
        externalId: `mock:${ctx.jobId}`,
        data: { output: { text: `[${input.targetLang}] ${input.text}` }, usage: {} },
      };
    }
    const { text, usage } = await callClaude(
      `把下面的短剧台词翻译成 ${input.targetLang}，保持口语化、贴合竖屏短剧节奏，只输出译文：\n${input.text}`,
      16000,
    );
    return { externalId: `claude:${ctx.jobId}`, data: { output: { text }, usage } };
  },
  async poll(handle) {
    const d = handle.data as { output: TranslateOutput; usage: Usage };
    return { state: 'succeeded', output: d.output, usage: d.usage };
  },
};
