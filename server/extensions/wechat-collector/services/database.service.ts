import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const datasourceUrl = normalizeSqliteUrl(process.env.DATABASE_URL);

export const prisma = new PrismaClient({
  datasources: datasourceUrl
    ? {
        db: {
          url: datasourceUrl,
        },
      }
    : undefined,
});

console.log('[Database] Initialized successfully');

export async function recoverCollectorState(): Promise<void> {
  await ensureCollectorSchema();

  await prisma.crawlRun.updateMany({
    where: { status: 'RUNNING' },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      error: '服务重启',
    },
  });

  await prisma.article.updateMany({
    where: { status: 'PROCESSING' },
    data: { status: 'PENDING' },
  });
}

export async function checkDatabase(): Promise<'connected' | 'error'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return 'error';
  }
}

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

function normalizeSqliteUrl(url: string | undefined): string | undefined {
  if (!url?.startsWith('file:./')) {
    return url;
  }

  const relativePath = url.slice('file:'.length);
  const absolutePath = resolve(process.cwd(), relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  return `file:${absolutePath}`;
}

async function ensureCollectorSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "system_config" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "account" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "entity_name" TEXT,
      "is_verified" BOOLEAN NOT NULL DEFAULT false,
      "last_crawl_time" DATETIME,
      "extra" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "article" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "url" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "digest" TEXT,
      "account_id" TEXT NOT NULL,
      "publish_time" INTEGER,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "retry_count" INTEGER NOT NULL DEFAULT 0,
      "last_error" TEXT,
      "failed_at" DATETIME,
      "content" TEXT,
      "extra" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL,
      CONSTRAINT "article_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "article_url_key" ON "article"("url")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "article_account_id_idx" ON "article"("account_id")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "article_status_idx" ON "article"("status")');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "monitor_target" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "subject_name" TEXT NOT NULL,
      "check_interval_minutes" INTEGER NOT NULL DEFAULT 720,
      "webhook_url" TEXT,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "last_run_at" DATETIME,
      "next_run_at" DATETIME NOT NULL,
      "last_crawl_time" DATETIME,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "crawl_run" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "target_id" TEXT NOT NULL,
      "trigger_type" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'RUNNING',
      "accounts_checked" INTEGER NOT NULL DEFAULT 0,
      "articles_new" INTEGER NOT NULL DEFAULT 0,
      "articles_failed" INTEGER NOT NULL DEFAULT 0,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completed_at" DATETIME,
      "error" TEXT,
      CONSTRAINT "crawl_run_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "monitor_target" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "crawl_run_target_id_started_at_idx" ON "crawl_run"("target_id", "started_at")'
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "collection_task" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "subject_name" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "progress" TEXT NOT NULL,
      "error" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL
    )
  `);
}
