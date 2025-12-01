import { PrismaClient } from '@prisma/client';

// 解决 BigInt 序列化问题 (Prisma 返回 BigInt, JSON.stringify 不支持)
// @ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString();
};

/**
 * 数据库服务
 * 提供全局唯一的 PrismaClient 实例
 * 支持从环境变量 DATABASE_URL 读取连接 (实现 SQLite/PostgreSQL 无缝切换)
 */
const datasourceUrl = process.env.DATABASE_URL;

export const prisma = new PrismaClient({
  datasources: datasourceUrl ? {
    db: {
      url: datasourceUrl,
    },
  } : undefined,
  // log: ['query', 'info', 'warn', 'error'],
});

console.log(`[Database] Initialized with URL: ${datasourceUrl || 'Auto-detected from schema'}`);

// 处理进程退出时的连接关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
