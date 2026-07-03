import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { __sfPrisma?: PrismaClient };

/** 全局单例：Next dev 热重载不泄漏连接 */
export const prisma: PrismaClient = globalForPrisma.__sfPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.__sfPrisma = prisma;

export * from '@prisma/client';
