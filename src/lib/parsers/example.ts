import * as cheerio from "cheerio";
import {
  ArticleMeta,
  FetchContentResult,
  SiteParser,
  normalizeUrl,
  extractBestImage,
} from "./base";

/**
 * Example parser template.
 * Copy this file and customize for your target site.
 *
 * Steps:
 * 1. Copy this file: cp example.ts my-site.ts
 * 2. Implement fetchArticleList() to extract article links from the listing page
 * 3. Implement fetchArticleContent() to extract content from each article page
 * 4. Register in index.ts: import and add to the parsers map
 * 5. Add the site to the database via prisma/seed.ts or the settings UI
 */
export class ExampleParser implements SiteParser {
  async fetchArticleList(
    url: string,
    config: Record<string, string>
  ): Promise<ArticleMeta[]> {
    const baseUrl = new URL(url).origin;
    const maxPages = parseInt(config.maxPages || "1");

    const articles: ArticleMeta[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= maxPages; page++) {
      const pageUrl = page === 1 ? url : `${url}?page=${page}`;
      const res = await fetch(pageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (!res.ok) break;

      const html = await res.text();
      const $ = cheerio.load(html);

      // Customize these selectors for your target site
      $(".article-list .article-item").each((_i, el) => {
        const $el = $(el);
        const href = $el.find("a").attr("href");
        if (!href) return;

        const fullUrl = normalizeUrl(href, baseUrl);
        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        const title = $el.find(".article-title").text().trim();
        const dateStr = $el.find(".article-date").text().trim();
        const img =
          $el.find("img").attr("src") || $el.find("img").attr("data-src");

        articles.push({
          externalUrl: fullUrl,
          title: title || "Untitled",
          publishedAt: dateStr ? new Date(dateStr) : undefined,
          snippet: img ? normalizeUrl(img, baseUrl) : undefined,
        });
      });
    }

    console.log(`[Example] Found ${articles.length} articles from ${url}`);
    return articles;
  }

  async fetchArticleContent(url: string): Promise<FetchContentResult> {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(url).origin;

    const imageUrl = extractBestImage($, baseUrl, [
      ".article-content",
      ".post-body",
    ]);

    // Remove noise elements
    $("nav, footer, header, script, style, .sidebar, .cookie-banner").remove();

    // Extract main content (customize selectors)
    const content =
      $(".article-content, .post-body, article, main")
        .first()
        .text()
        .trim() || $("body").text().trim();

    return {
      content: content.replace(/\s+/g, " ").slice(0, 10000),
      imageUrl,
    };
  }
}
