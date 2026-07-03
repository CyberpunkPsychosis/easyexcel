/** mock adapter 的占位资产生成：SVG 图与静音 WAV，零外部依赖 */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SvgPlaceholderOptions {
  title: string;
  subtitle?: string;
  badge?: string;
  width?: number;
  height?: number;
  hue?: number;
}

/** 竖屏 9:16 占位图：渐变底 + 提示词摘要 + 适配器徽标 */
export function svgPlaceholder(opts: SvgPlaceholderOptions): string {
  const w = opts.width ?? 720;
  const h = opts.height ?? 1280;
  const hue = opts.hue ?? 220;
  const title = escapeXml(opts.title.slice(0, 60));
  const subtitle = escapeXml((opts.subtitle ?? '').slice(0, 80));
  const badge = escapeXml(opts.badge ?? 'mock');
  const lines: string[] = [];
  for (let i = 0; i < title.length; i += 16) lines.push(title.slice(i, i + 16));
  const titleSpans = lines
    .slice(0, 4)
    .map((line, i) => `<tspan x="50%" dy="${i === 0 ? 0 : 52}">${line}</tspan>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},45%,18%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 60) % 360},50%,10%)"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w * 0.8}" cy="${h * 0.15}" r="120" fill="hsl(${hue},60%,30%)" opacity="0.35"/>
  <circle cx="${w * 0.15}" cy="${h * 0.85}" r="160" fill="hsl(${(hue + 40) % 360},60%,35%)" opacity="0.25"/>
  <text x="50%" y="42%" text-anchor="middle" font-family="sans-serif" font-size="44" fill="#fff" opacity="0.92">${titleSpans}</text>
  <text x="50%" y="70%" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#fff" opacity="0.55">${subtitle}</text>
  <rect x="${w / 2 - 90}" y="${h - 140}" width="180" height="48" rx="24" fill="#000" opacity="0.4"/>
  <text x="50%" y="${h - 108}" text-anchor="middle" font-family="monospace" font-size="22" fill="#fff" opacity="0.8">${badge}</text>
</svg>`;
}

/** 生成静音 PCM WAV（mock TTS/音效用） */
export function silentWav(seconds: number, sampleRate = 8000): Buffer {
  const numSamples = Math.max(1, Math.floor(seconds * sampleRate));
  const dataSize = numSamples * 2; // 16-bit mono
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}
