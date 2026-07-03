import {
  computeCostCents,
  silentWav,
  type AssetOutput,
  type Credits,
  type JobStatus,
  type ModelAdapter,
  type TTSInput,
  type Usage,
} from '@stageforge/core';
import { defineMockTtsAdapter } from '../../mock';

/**
 * ElevenLabs v3。
 * 调研核验：1 分钟高质量样音即可克隆出带呼吸声/停顿感/自然抑扬顿挫的人声 —— 配音环节标杆。
 *
 * 真实接入（M2）：设置 ELEVENLABS_API_KEY 启用；可用 ELEVENLABS_VOICE_ID 指定音色
 * （默认用官方公共音色）。无 key 自动降级 mock（静音 WAV）。
 */
const ELEVEN_COST = { unit: 'per_1k_char', price: 0.3, currency: 'USD' } as const;
const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM'; // ElevenLabs 公共音色 Rachel

function elevenKey(): string | undefined {
  return process.env.ELEVENLABS_API_KEY || undefined;
}

export const elevenlabsTts: ModelAdapter<TTSInput, AssetOutput> = {
  id: 'elevenlabs-v3',
  capability: 'audio.tts',
  displayName: 'ElevenLabs v3',
  provider: 'ElevenLabs',
  region: 'global',
  caps: { async: false },
  cost: ELEVEN_COST,
  mock: false, // 有 ELEVENLABS_API_KEY 时真实调用；无 key 运行时降级 mock
  notes: '配音标杆 · 1 分钟样音克隆自然人声 · ELEVENLABS_API_KEY 启用真实调用',
  confidence: 'verified',
  estimateCost(input): Credits {
    return computeCostCents(ELEVEN_COST, { chars: input.text.length });
  },
  async submit(input, ctx) {
    const usage: Usage = { chars: input.text.length };
    if (!elevenKey()) {
      ctx.log('elevenlabs: 无 ELEVENLABS_API_KEY，降级静音 mock');
      const seconds = Math.min(8, Math.max(1, input.text.length / 6));
      const asset = await ctx.saveAsset({
        kind: 'audio',
        data: silentWav(seconds),
        contentType: 'audio/wav',
        ext: 'wav',
        meta: { mock: true, text: input.text.slice(0, 100) },
      });
      return { externalId: `mock:${ctx.jobId}`, data: { output: { asset }, usage } };
    }

    const voiceId = input.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': elevenKey()!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`ElevenLabs API ${res.status}: ${detail.slice(0, 300)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const asset = await ctx.saveAsset({
      kind: 'audio',
      data: buf,
      contentType: 'audio/mpeg',
      ext: 'mp3',
      meta: { source: 'elevenlabs', voiceId, text: input.text.slice(0, 100) },
    });
    return { externalId: `eleven:${ctx.jobId}`, data: { output: { asset }, usage } };
  },
  async poll(handle): Promise<JobStatus<AssetOutput>> {
    const d = handle.data as { output: AssetOutput; usage: Usage };
    return { state: 'succeeded', output: d.output, usage: d.usage };
  },
};

/** 声音克隆：真实实现需先上传样音建 voice（M3 计划）；当前 mock 占位 */
export const elevenlabsClone = defineMockTtsAdapter({
  id: 'elevenlabs-clone',
  capability: 'audio.voiceclone',
  displayName: 'ElevenLabs 声音克隆',
  provider: 'ElevenLabs',
  region: 'global',
  caps: { async: true },
  cost: ELEVEN_COST,
  notes: '出海多语配音主力（配合 text.translate + audio.lipsync）· 克隆建库 M3 接入',
  confidence: 'verified',
});
