-- AlterTable: add new columns to article
ALTER TABLE "article" ADD COLUMN "digest" TEXT;
ALTER TABLE "article" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "article" ADD COLUMN "last_error" TEXT;
ALTER TABLE "article" ADD COLUMN "failed_at" TIMESTAMP(3);

-- AlterTable: change status from INT to VARCHAR
ALTER TABLE "article" ALTER COLUMN "status" TYPE VARCHAR(20) USING CASE status WHEN 0 THEN 'PENDING' WHEN 1 THEN 'PROCESSING' WHEN 2 THEN 'DONE' WHEN 3 THEN 'FAILED' ELSE 'PENDING' END;
ALTER TABLE "article" ALTER COLUMN "status" SET DEFAULT 'PENDING';
