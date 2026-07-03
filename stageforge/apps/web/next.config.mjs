import { config } from 'dotenv';
// 单一 .env 放 monorepo 根（npm -w 运行时 cwd 是 apps/web）；文件缺失时静默跳过
config({ path: '../../.env' });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@stageforge/core', '@stageforge/adapters', '@stageforge/db'],
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'bullmq',
      'ioredis',
      '@aws-sdk/client-s3',
      '@aws-sdk/s3-request-presigner',
      '@anthropic-ai/sdk',
      'bcryptjs',
    ],
  },
};

export default nextConfig;
