import fs from 'node:fs';
import path from 'node:path';

/**
 * 从当前工作目录向上找 monorepo 根（package.json name === 'stageforge-monorepo'）。
 * web 的 cwd 是 apps/web、worker 是 apps/worker，本地存储/相对路径必须共享同一个根。
 */
export function findMonorepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkg, 'utf8')) as { name?: string };
        if (parsed.name === 'stageforge-monorepo') return dir;
      } catch {
        // ignore malformed package.json on the way up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

export const env = {
  get redisUrl() {
    return process.env.REDIS_URL ?? 'redis://localhost:6379';
  },
  get storageDriver(): 'local' | 's3' {
    return process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
  },
  get dataDir() {
    const configured = process.env.DATA_DIR;
    if (configured && path.isAbsolute(configured)) return configured;
    return path.join(findMonorepoRoot(), configured ?? '.data');
  },
  get s3() {
    return {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET ?? 'stageforge',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    };
  },
  get ffmpegPath() {
    return process.env.FFMPEG_PATH ?? 'ffmpeg';
  },
};
