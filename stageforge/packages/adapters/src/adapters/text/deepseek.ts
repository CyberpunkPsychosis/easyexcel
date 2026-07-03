import { mockStoryboardFromScript, type StoryboardInput, type StoryboardOutput } from '@stageforge/core';
import { defineMockAdapter } from '../../mock';

/** DeepSeek —— 国内低成本 LLM 选项。M1 为 mock。 */
export const deepseekStoryboard = defineMockAdapter<StoryboardInput, StoryboardOutput>(
  {
    id: 'deepseek-storyboard',
    capability: 'text.storyboard',
    displayName: 'DeepSeek（分镜拆解）',
    provider: 'DeepSeek',
    region: 'cn',
    caps: { async: false },
    cost: { unit: 'per_1k_token', input: 0.004, output: 0.016, currency: 'CNY' },
    notes: 'M1 mock；国内直连、成本最低的 LLM 选项之一',
    confidence: 'uncertain',
  },
  (input) => ({ inputTokens: input.script.length, outputTokens: 8000 }),
  async (input) => ({
    output: { storyboard: mockStoryboardFromScript(input.script, input.characterNames ?? []) },
    usage: { inputTokens: input.script.length, outputTokens: 2000 },
  }),
);
