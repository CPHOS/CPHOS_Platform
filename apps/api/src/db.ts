import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var __cphosPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__cphosPrisma ??
  new PrismaClient({
    // 显式传入连接串：env.DATABASE_URL 有默认值（内嵌 PG），确保 Prisma 读取到
    datasourceUrl: env.DATABASE_URL,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__cphosPrisma = prisma;
}
