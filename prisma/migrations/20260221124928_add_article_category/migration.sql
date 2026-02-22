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
    "category" TEXT NOT NULL DEFAULT 'news',
    "is_new" BOOLEAN NOT NULL DEFAULT true,
    "detected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "articles_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_articles" ("created_at", "detected_at", "external_url", "id", "image_url", "is_new", "published_at", "raw_content", "site_id", "summary_ja", "title") SELECT "created_at", "detected_at", "external_url", "id", "image_url", "is_new", "published_at", "raw_content", "site_id", "summary_ja", "title" FROM "articles";
DROP TABLE "articles";
ALTER TABLE "new_articles" RENAME TO "articles";
CREATE UNIQUE INDEX "articles_external_url_key" ON "articles"("external_url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
