import type { Capability, ModelAdapter } from '@stageforge/core';

import { claudeScript, claudeStoryboard, claudeTranslate } from './adapters/text/claude';
import { gptStoryboard } from './adapters/text/openai';
import { deepseekStoryboard } from './adapters/text/deepseek';
import { geminiStoryboard } from './adapters/text/gemini';

import { jimengT2I } from './adapters/image/jimeng';
import { midjourneyT2I } from './adapters/image/midjourney';
import { fluxT2I } from './adapters/image/flux';
import { comfyuiT2I } from './adapters/image/comfyui';

import { jimengOmniRef } from './adapters/character/jimeng-omniref';
import { ipAdapterFaceId } from './adapters/character/ipadapter';
import { loraTraining } from './adapters/character/lora';

import { seedanceI2V, seedanceT2V } from './adapters/video/seedance';
import { klingI2V } from './adapters/video/kling';
import { hailuoI2V } from './adapters/video/hailuo';
import { veoI2V } from './adapters/video/veo';
import { soraI2V } from './adapters/video/sora';
import { wanI2V } from './adapters/video/wan';
import { viduI2V } from './adapters/video/vidu';
import { runwayI2V } from './adapters/video/runway';
import { ltxI2V } from './adapters/video/ltx';

import { elevenlabsClone, elevenlabsTts } from './adapters/audio/elevenlabs';
import { jimengVoice } from './adapters/audio/jimeng-voice';
import { minimaxTts } from './adapters/audio/minimax';
import { syncSo } from './adapters/audio/sync-so';
import { musetalk } from './adapters/audio/musetalk';
import { jianyingLipsync } from './adapters/audio/jianying';
import { sunoMusic } from './adapters/audio/suno';
import { udioMusic } from './adapters/audio/udio';
import { jimengSfx } from './adapters/audio/jimeng-sfx';

import { internalFfmpeg } from './adapters/render/internal-ffmpeg';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdapter = ModelAdapter<any, any>;

/**
 * 全量注册表 —— 新增模型：上面 import 一行 + 这里一行，其余零改动。
 * （活示例见 ./adapters/video/_example-newmodel.ts）
 */
const ALL_ADAPTERS: AnyAdapter[] = [
  // text
  claudeScript,
  claudeStoryboard,
  claudeTranslate,
  gptStoryboard,
  deepseekStoryboard,
  geminiStoryboard,
  // image.t2i
  jimengT2I,
  midjourneyT2I,
  fluxT2I,
  comfyuiT2I,
  // image.character
  jimengOmniRef,
  ipAdapterFaceId,
  loraTraining,
  // video
  seedanceI2V,
  seedanceT2V,
  klingI2V,
  hailuoI2V,
  veoI2V,
  soraI2V,
  wanI2V,
  viduI2V,
  runwayI2V,
  ltxI2V,
  // audio
  elevenlabsTts,
  elevenlabsClone,
  jimengVoice,
  minimaxTts,
  syncSo,
  musetalk,
  jianyingLipsync,
  sunoMusic,
  udioMusic,
  jimengSfx,
  // render
  internalFfmpeg,
];

const byId = new Map<string, AnyAdapter>();
const byCapability = new Map<Capability, AnyAdapter[]>();

for (const adapter of ALL_ADAPTERS) {
  if (byId.has(adapter.id)) throw new Error(`duplicate adapter id: ${adapter.id}`);
  byId.set(adapter.id, adapter);
  const list = byCapability.get(adapter.capability) ?? [];
  list.push(adapter);
  byCapability.set(adapter.capability, list);
}

export function getAdapter(id: string): AnyAdapter {
  const adapter = byId.get(id);
  if (!adapter) throw new Error(`unknown adapter: ${id}`);
  return adapter;
}

export function tryGetAdapter(id: string): AnyAdapter | undefined {
  return byId.get(id);
}

export function listAdapters(capability?: Capability): AnyAdapter[] {
  if (!capability) return ALL_ADAPTERS;
  return byCapability.get(capability) ?? [];
}

/** 给 API/UI 的可序列化视图（剥掉函数） */
export interface SerializedAdapter {
  id: string;
  capability: Capability;
  displayName: string;
  provider: string;
  region: 'cn' | 'global';
  caps: AnyAdapter['caps'];
  cost: AnyAdapter['cost'];
  mock: boolean;
  notes?: string;
  confidence?: 'verified' | 'uncertain';
}

export function serializeAdapter(a: AnyAdapter): SerializedAdapter {
  return {
    id: a.id,
    capability: a.capability,
    displayName: a.displayName,
    provider: a.provider,
    region: a.region,
    caps: a.caps,
    cost: a.cost,
    mock: a.mock,
    notes: a.notes,
    confidence: a.confidence,
  };
}
