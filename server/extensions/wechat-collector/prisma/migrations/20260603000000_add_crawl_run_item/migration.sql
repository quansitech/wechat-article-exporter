-- CreateTable
CREATE TABLE "crawl_run_item" (
    "id" VARCHAR(255) NOT NULL,
    "crawl_run_id" VARCHAR(255) NOT NULL,
    "article_id" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DISCOVERED',
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "crawl_run_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crawl_run_item_crawl_run_id_article_id_key" ON "crawl_run_item"("crawl_run_id", "article_id");

-- CreateIndex
CREATE INDEX "crawl_run_item_article_id_idx" ON "crawl_run_item"("article_id");

-- AddForeignKey
ALTER TABLE "crawl_run_item" ADD CONSTRAINT "crawl_run_item_crawl_run_id_fkey" FOREIGN KEY ("crawl_run_id") REFERENCES "crawl_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
