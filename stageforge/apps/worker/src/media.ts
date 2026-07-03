import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '@stageforge/core';

const execFileAsync = promisify(execFile);

let ffmpegAvailable: boolean | null = null;

export function hasFfmpeg(): boolean {
  if (ffmpegAvailable === null) {
    try {
      execFileSync(env.ffmpegPath, ['-version'], { stdio: 'ignore' });
      ffmpegAvailable = true;
    } catch {
      ffmpegAvailable = false;
    }
  }
  return ffmpegAvailable;
}

/** drawtext 滤镜文本转义（ffmpeg 的转义规则相当刁钻） */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\\\\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,');
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 1 - l)) / 100 / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1) * 100;
    return Math.round(255 * Math.max(0, Math.min(1, c / 100)))
      .toString(16)
      .padStart(2, '0');
  };
  return `${f(0)}${f(8)}${f(4)}`;
}

async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync(env.ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** mock 视频适配器用：lavfi 渲染一段带文字的竖屏占位 mp4 */
export async function renderPlaceholderVideoBuffer(opts: {
  durationSec: number;
  title: string;
  subtitle?: string;
  hue?: number;
}): Promise<Buffer | null> {
  if (!hasFfmpeg()) return null;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-mockvid-'));
  const out = path.join(tmp, 'out.mp4');
  const color = hslToHex(opts.hue ?? 220, 40, 18);
  const src = `color=c=0x${color}:s=720x1280:d=${Math.max(1, opts.durationSec)}:r=24`;
  const title = escapeDrawtext(opts.title.slice(0, 28));
  const subtitle = escapeDrawtext((opts.subtitle ?? '').slice(0, 40));
  const drawtext =
    `drawtext=text='${title}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h*0.42:font=Sans,` +
    `drawtext=text='${subtitle}':fontcolor=white@0.6:fontsize=24:x=(w-text_w)/2:y=h*0.55:font=Sans`;
  try {
    try {
      await runFfmpeg(['-f', 'lavfi', '-i', src, '-vf', drawtext, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    } catch {
      // 环境缺 freetype/字体 → 退化为无文字的纯色视频
      await runFfmpeg(['-f', 'lavfi', '-i', src, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    }
    return await fs.readFile(out);
  } catch (e) {
    console.warn('renderPlaceholderVideoBuffer failed:', e);
    return null;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

export interface ComposeSegment {
  filePath: string;
  dialogue: string;
}

/**
 * 成片合成：多段 mp4 → 统一 1080x1920 竖屏 → 逐段烧台词字幕 → concat（可选 BGM 混音）。
 * 字幕默认开启：调研核验约 80% 观众静音观看短剧，字幕直接影响完播率（附录 A.4）。
 */
export async function composeVertical(
  segments: ComposeSegment[],
  outPath: string,
  opts: { musicPath?: string; watermarkText?: string } = {},
): Promise<void> {
  if (!hasFfmpeg()) throw new Error('环境缺少 ffmpeg，无法合成成片（本地请安装 ffmpeg，部署见 DEPLOY.md）');
  const inputs = segments.flatMap((s) => ['-i', s.filePath]);
  if (opts.musicPath) inputs.push('-i', opts.musicPath);

  const buildFilter = (withSubtitles: boolean) => {
    const chains = segments.map((s, i) => {
      const base =
        `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,` +
        `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=24`;
      const subtitle =
        withSubtitles && s.dialogue.trim()
          ? `,drawtext=text='${escapeDrawtext(s.dialogue.slice(0, 40))}':fontcolor=white:fontsize=52:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-320:font=Sans`
          : '';
      // AI 生成内容标识角标（合规卡点：watermark 开启时全片常显）
      const watermark =
        withSubtitles && opts.watermarkText
          ? `,drawtext=text='${escapeDrawtext(opts.watermarkText.slice(0, 40))}':fontcolor=white@0.55:fontsize=26:x=24:y=32:font=Sans`
          : '';
      return `${base}${subtitle}${watermark}[v${i}]`;
    });
    const concat = `${segments.map((_, i) => `[v${i}]`).join('')}concat=n=${segments.length}:v=1:a=0[outv]`;
    return [...chains, concat].join(';');
  };

  const audioArgs = opts.musicPath
    ? ['-map', `${segments.length}:a`, '-c:a', 'aac', '-shortest']
    : [];
  const common = ['-map', '[outv]', ...audioArgs, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath];
  try {
    await runFfmpeg([...inputs, '-filter_complex', buildFilter(true), ...common]);
  } catch {
    // 字体缺失等 drawtext 失败 → 无字幕重试（并在日志提示）
    console.warn('composeVertical: drawtext 失败，无字幕重试（检查系统字体/freetype）');
    await runFfmpeg([...inputs, '-filter_complex', buildFilter(false), ...common]);
  }
}
