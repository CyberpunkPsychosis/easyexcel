import fs from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** s3 驱动返回预签名 URL；local 返回 null（走 /api/assets/:id 流式输出） */
  presignedUrl(key: string): Promise<string | null>;
}

class LocalStorage implements StorageDriver {
  private root = path.join(env.dataDir, 'assets');

  private resolve(key: string) {
    const p = path.join(this.root, key);
    if (!p.startsWith(this.root)) throw new Error(`invalid storage key: ${key}`);
    return p;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async presignedUrl(): Promise<string | null> {
    return null;
  }
}

class S3Storage implements StorageDriver {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const cfg = env.s3;
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`empty object: ${key}`);
    return Buffer.from(bytes);
  }

  async presignedUrl(key: string): Promise<string | null> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: 3600,
    });
  }
}

let cached: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (!cached) cached = env.storageDriver === 's3' ? new S3Storage() : new LocalStorage();
  return cached;
}
