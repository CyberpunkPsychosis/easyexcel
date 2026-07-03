import { mockStoryboardFromScript, type StoryboardInput, type StoryboardOutput } from '@stageforge/core';
import { defineMockAdapter } from '../../mock';

/**
 * OpenAI GPT —— M1 为 mock（接真实 API 时替换 produce 即可，接口不变）。
 * GPT-5.x per-1k-token 价格为占位估值，接入时在 settings 校准。
 */
export const gptStoryboard = defineMockAdapter<StoryboardInput, StoryboardOutput>(
  {
    id: 'gpt-storyboard',
    capability: 'text.storyboard',
    displayName: 'GPT（分镜拆解）',
    provider: 'OpenAI',
    region: 'global',
    caps: { async: false },
    cost: { unit: 'per_1k_token', input: 0.00175, output: 0.014, currency: 'USD' },
    notes: 'M1 mock；OPENAI_API_KEY 接入后替换为真实实现',
    confidence: 'uncertain',
  },
  (input) => ({ inputTokens: input.script.length, outputTokens: 8000 }),
  async (input) => ({
    output: { storyboard: mockStoryboardFromScript(input.script, input.characterNames ?? []) },
    usage: { inputTokens: input.script.length, outputTokens: 2000 },
  }),
);
