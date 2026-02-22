import { prisma } from "@/lib/db/prisma";
import { getParser } from "@/lib/parsers";
import { sleep, filterImageUrl } from "@/lib/parsers/base";
import { summarizeArticle, summarizeProduct } from "@/lib/summarizer/claude";
import type { Site } from "@prisma/client";

const MAX_NEW_ARTICLES_PER_CRAWL = 20;
const DELAY_BETWEEN_FETCHES_MS = 2000;

export async function crawlSite(site: Site): Promise<{
  articlesFound: number;
  newArticles: number;
  errors: string[];
}> {
  const startedAt = new Date();
  const errors: string[] = [];
  let articlesFound = 0;
  let newArticlesCount = 0;

  try {
    const parser = getParser(site.parserType, site.name);
    const config: Record<string, string> = site.parserConfig
      ? JSON.parse(site.parserConfig)
      : {};

    // Step 1: Fetch article list
    console.log(`[Crawler] Fetching article list for ${site.name}...`);
    const articleMetas = await parser.fetchArticleList(site.url, config);
    articlesFound = articleMetas.length;
    console.log(`[Crawler] Found ${articlesFound} articles for ${site.name}`);

    // Step 2: Check which articles are new (global check — externalUrl is unique)
    const candidateUrls = articleMetas.map((a) => a.externalUrl);
    const existingUrls = new Set(
      (
        await prisma.article.findMany({
          where: { externalUrl: { in: candidateUrls } },
          select: { externalUrl: true },
        })
      ).map((a) => a.externalUrl)
    );

    const newArticles = articleMetas
      .filter((a) => !existingUrls.has(a.externalUrl))
      .slice(0, MAX_NEW_ARTICLES_PER_CRAWL);

    console.log(
      `[Crawler] ${newArticles.length} new articles for ${site.name}`
    );

    // For product articles without publishedAt, assign position-based dates
    // Manufacturers typically list newer products first on their pages
    const isProduct =
      site.parserType.endsWith("-product") || config.category === "product";
    if (isProduct) {
      const now = new Date();
      articleMetas.forEach((meta, index) => {
        if (!meta.publishedAt) {
          // First product = newest = today, each subsequent = 1 day older
          meta.publishedAt = new Date(now.getTime() - index * 86400000);
        }
      });
    }

    // Step 3: Fetch content and summarize for each new article
    for (const meta of newArticles) {
      try {
        await sleep(DELAY_BETWEEN_FETCHES_MS);

        console.log(`[Crawler] Fetching content: ${meta.title}`);
        let content = "";
        let imageUrl: string | undefined;

        // Extract image URL from snippet if encoded there (e.g. __IMG__url__)
        if (meta.snippet?.startsWith("__IMG__")) {
          const parts = meta.snippet.slice(7).split("__", 2);
          imageUrl = parts[0] || undefined;
          meta.snippet = parts[1] || undefined;
        }

        try {
          const result = await parser.fetchArticleContent(meta.externalUrl);
          if (typeof result === "string") {
            content = result;
          } else {
            content = result.content;
            if (result.imageUrl) imageUrl = result.imageUrl;
          }
        } catch (e) {
          console.warn(`[Crawler] Content fetch failed for ${meta.externalUrl}:`, e);
          content = meta.snippet || meta.title;
        }

        // Filter out generic logo/default images
        imageUrl = filterImageUrl(imageUrl);

        // Generate summary — use product prompt for product parsers
        const isProduct =
          site.parserType.endsWith("-product") || config.category === "product";
        let summaryJa = "";
        try {
          if (content.length > 50) {
            summaryJa = isProduct
              ? await summarizeProduct(meta.title, content)
              : await summarizeArticle(meta.title, content);
          } else {
            summaryJa = meta.snippet || "本文を取得できなかったため、要約を生成できませんでした。";
          }
        } catch (e) {
          console.warn(`[Crawler] Summary generation failed:`, e);
          summaryJa = meta.snippet || "要約の生成に失敗しました。";
        }

        // Use upsert to avoid unique constraint errors on concurrent/duplicate URLs
        const result = await prisma.article.upsert({
          where: { externalUrl: meta.externalUrl },
          update: {},  // Already exists — skip
          create: {
            siteId: site.id,
            externalUrl: meta.externalUrl,
            title: meta.title,
            publishedAt: meta.publishedAt,
            imageUrl,
            rawContent: content.slice(0, 50000),
            summaryJa,
            category: isProduct ? "product" : "news",
            isNew: true,
          },
        });

        // Count as new only if just created (no prior summaryJa would indicate it's truly new)
        if (result.isNew) newArticlesCount++;
      } catch (e) {
        const msg = `Error processing ${meta.externalUrl}: ${e}`;
        console.error(`[Crawler] ${msg}`);
        errors.push(msg);
      }
    }

    // Log success
    const finishedAt = new Date();
    await prisma.crawlLog.create({
      data: {
        siteId: site.id,
        status: errors.length > 0 ? "partial" : "success",
        articlesFound,
        newArticles: newArticlesCount,
        errorMessage: errors.length > 0 ? errors.join("; ") : null,
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      },
    });
  } catch (e) {
    const msg = `Crawl failed for ${site.name}: ${e}`;
    console.error(`[Crawler] ${msg}`);
    errors.push(msg);

    await prisma.crawlLog.create({
      data: {
        siteId: site.id,
        status: "error",
        articlesFound: 0,
        newArticles: 0,
        errorMessage: msg,
        startedAt,
        finishedAt: new Date(),
        durationMs: new Date().getTime() - startedAt.getTime(),
      },
    });
  }

  return { articlesFound, newArticles: newArticlesCount, errors };
}

export async function crawlAllSites(): Promise<
  Record<string, { articlesFound: number; newArticles: number; errors: string[] }>
> {
  const sites = await prisma.site.findMany({
    where: { isActive: true },
  });

  const results: Record<
    string,
    { articlesFound: number; newArticles: number; errors: string[] }
  > = {};

  for (const site of sites) {
    console.log(`[Crawler] Starting crawl for ${site.name}...`);
    results[site.name] = await crawlSite(site);
    console.log(`[Crawler] Finished crawl for ${site.name}`);
  }

  return results;
}
