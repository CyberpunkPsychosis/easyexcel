import { Queue } from 'bullmq';
import { env } from './env';

export const GENERATION_QUEUE = 'sf-generation';
export const COMPOSE_QUEUE = 'sf-compose';

/** 队列消息只携带 jobId —— 全部业务参数落库在 GenerationJob.input，可审计可重放 */
export interface QueuePayload {
  jobId: string;
}

export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  /** BullMQ Worker 要求 */
  maxRetriesPerRequest: null;
  tls?: Record<string, never>;
}

export function redisConnection(): RedisConnectionOptions {
  const url = new URL(env.redisUrl);
  const opts: RedisConnectionOptions = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    maxRetriesPerRequest: null,
  };
  if (url.username) opts.username = url.username;
  if (url.password) opts.password = url.password;
  if (url.protocol === 'rediss:') opts.tls = {};
  return opts;
}

const queues = new Map<string, Queue<QueuePayload>>();

export function getQueue(name: string): Queue<QueuePayload> {
  let q = queues.get(name);
  if (!q) {
    q = new Queue<QueuePayload>(name, { connection: redisConnection() });
    queues.set(name, q);
  }
  return q;
}
