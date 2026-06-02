-- CreateTable
CREATE TABLE "monitor_target" (
    "id" VARCHAR(255) NOT NULL,
    "subject_name" VARCHAR(255) NOT NULL,
    "check_interval_minutes" INTEGER NOT NULL DEFAULT 720,
    "webhook_url" VARCHAR(512),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "last_crawl_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitor_target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_run" (
    "id" VARCHAR(255) NOT NULL,
    "target_id" VARCHAR(255) NOT NULL,
    "trigger_type" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "accounts_checked" INTEGER NOT NULL DEFAULT 0,
    "articles_new" INTEGER NOT NULL DEFAULT 0,
    "articles_failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "crawl_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawl_run_target_id_started_at_idx" ON "crawl_run"("target_id", "started_at");

-- AddForeignKey
ALTER TABLE "crawl_run" ADD CONSTRAINT "crawl_run_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "monitor_target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
