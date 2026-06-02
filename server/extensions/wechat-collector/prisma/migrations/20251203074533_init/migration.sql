-- CreateTable
CREATE TABLE "system_config" (
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "account" (
    "id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "entity_name" VARCHAR(255),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_crawl_time" TIMESTAMP(3),
    "extra" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article" (
    "id" VARCHAR(255) NOT NULL,
    "url" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "account_id" VARCHAR(255) NOT NULL,
    "publish_time" BIGINT,
    "status" INTEGER NOT NULL DEFAULT 0,
    "local_path" VARCHAR(255),
    "content" TEXT,
    "extra" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_task" (
    "id" VARCHAR(255) NOT NULL,
    "subject_name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "progress" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_url_key" ON "article"("url");

-- AddForeignKey
ALTER TABLE "article" ADD CONSTRAINT "article_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
