import { mockStoryboardFromScript, type StoryboardInput, type StoryboardOutput } from '@stageforge/core';
import { defineMockAdapter } from '../../mock';

/** Google Gemini —— M1 为 mock。 */
export const geminiStoryboard = defineMockAdapter<StoryboardInput, StoryboardOutput>(
  {
    id: 'gemini-storyboard',
    capability: 'text.storyboard',
    displayName: 'Gemini（分镜拆解）',
    provider: 'Google',
    region: 'global',
    caps: { async: false },
    cost: { unit: 'per_1k_token', input: 0.00125, output: 0.01, currency: 'USD' },
    notes: 'M1 mock；GOOGLE_API_KEY 接入后替换为真实实现',
    confidence: 'uncertain',
  },
  (input) => ({ inputTokens: input.script.length, outputTokens: 8000 }),
  async (input) => ({
    output: { storyboard: mockStoryboardFromScript(input.script, input.characterNames ?? []) },
    usage: { inputTokens: input.script.length, outputTokens: 2000 },
  }),
);
