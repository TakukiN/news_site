/*
  Warnings:

  - Added the required column `genre_id` to the `sites` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "genres" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "article_comments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "article_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "article_comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "article_views" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "article_id" INTEGER NOT NULL,
    "viewed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "article_views_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_articles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "site_id" INTEGER NOT NULL,
    "external_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "published_at" DATETIME,
    "image_url" TEXT,
    "raw_content" TEXT,
    "summary_ja" TEXT,
    "detail_summary_ja" TEXT,
    "category" TEXT NOT NULL DEFAULT 'news',
    "is_new" BOOLEAN NOT NULL DEFAULT true,
    "is_favorited" BOOLEAN NOT NULL DEFAULT false,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "detected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "articles_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_articles" ("category", "created_at", "detected_at", "external_url", "id", "image_url", "is_new", "published_at", "raw_content", "site_id", "summary_ja", "title") SELECT "category", "created_at", "detected_at", "external_url", "id", "image_url", "is_new", "published_at", "raw_content", "site_id", "summary_ja", "title" FROM "articles";
DROP TABLE "articles";
ALTER TABLE "new_articles" RENAME TO "articles";
CREATE UNIQUE INDEX "articles_external_url_key" ON "articles"("external_url");
CREATE TABLE "new_sites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "parser_type" TEXT NOT NULL,
    "parser_config" TEXT,
    "cron_interval" TEXT NOT NULL DEFAULT '0 */6 * * *',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "genre_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sites_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Insert default genre
INSERT INTO "genres" ("name", "slug", "sort_order", "created_at", "updated_at")
VALUES ('ウォッチャー', 'default', 0, datetime('now'), datetime('now'));
-- Migrate existing sites with default genre_id = 1
INSERT INTO "new_sites" ("color", "created_at", "cron_interval", "id", "is_active", "name", "parser_config", "parser_type", "updated_at", "url", "genre_id") SELECT "color", "created_at", "cron_interval", "id", "is_active", "name", "parser_config", "parser_type", "updated_at", "url", 1 FROM "sites";
DROP TABLE "sites";
ALTER TABLE "new_sites" RENAME TO "sites";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE INDEX "article_views_article_id_viewed_at_idx" ON "article_views"("article_id", "viewed_at");
