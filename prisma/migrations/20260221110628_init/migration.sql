-- CreateTable
CREATE TABLE "sites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "parser_type" TEXT NOT NULL,
    "parser_config" TEXT,
    "cron_interval" TEXT NOT NULL DEFAULT '0 */6 * * *',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "articles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "site_id" INTEGER NOT NULL,
    "external_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "published_at" DATETIME,
    "raw_content" TEXT,
    "summary_ja" TEXT,
    "is_new" BOOLEAN NOT NULL DEFAULT true,
    "detected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "articles_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "crawl_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "site_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "articles_found" INTEGER NOT NULL DEFAULT 0,
    "new_articles" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" DATETIME NOT NULL,
    "finished_at" DATETIME,
    "duration_ms" INTEGER,
    CONSTRAINT "crawl_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_external_url_key" ON "articles"("external_url");
