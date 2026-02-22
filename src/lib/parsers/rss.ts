import * as cheerio from "cheerio";
import {
  ArticleMeta,
  FetchContentResult,
  SiteParser,
  normalizeUrl,
  extractBestImage,
} from "./base";

/**
 * Generic RSS/Atom feed parser.
 * Supports both RSS 2.0 (<item>) and Atom (<entry>) feeds.
 */
export class RssParser implements SiteParser {
  async fetchArticleList(
    url: string,
    _config: Record<string, string>
  ): Promise<ArticleMeta[]> {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CompetitorWatch/1.0)",
      },
    });
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const articles: ArticleMeta[] = [];
    const baseUrl = new URL(url).origin;

    // RSS 2.0 format: <item>
    $("item").each((_i, el) => {
      const $item = $(el);
      const title = $item.find("title").text().trim();
      const link = $item.find("link").text().trim();
      const pubDate = $item.find("pubDate").text().trim();
      const description = $item.find("description").text().trim();

      if (!title || !link) return;

      const fullUrl = link.startsWith("http")
        ? link
        : normalizeUrl(link, baseUrl);

      articles.push({
        externalUrl: fullUrl,
        title,
        publishedAt: pubDate ? new Date(pubDate) : undefined,
        snippet: description || undefined,
      });
    });

    // Atom format: <entry> (if no RSS items found)
    if (articles.length === 0) {
      $("entry").each((_i, el) => {
        const $entry = $(el);
        const title = $entry.find("title").text().trim();
        const link =
          $entry.find("link[rel='alternate']").attr("href") ||
          $entry.find("link").attr("href") ||
          "";
        const published =
          $entry.find("published").text().trim() ||
          $entry.find("updated").text().trim();
        const summary = $entry.find("summary").text().trim();

        if (!title || !link) return;

        const fullUrl = link.startsWith("http")
          ? link
          : normalizeUrl(link, baseUrl);

        articles.push({
          externalUrl: fullUrl,
          title,
          publishedAt: published ? new Date(published) : undefined,
          snippet: summary || undefined,
        });
      });
    }

    console.log(`[RSS] Found ${articles.length} items from ${url}`);
    return articles;
  }

  async fetchArticleContent(url: string): Promise<FetchContentResult> {
    // Skip PDF links
    if (url.toLowerCase().endsWith(".pdf")) {
      return {
        content: `PDF document: ${url}`,
        imageUrl: undefined,
      };
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CompetitorWatch/1.0)",
      },
    });
    if (!res.ok)
      throw new Error(`RSS article fetch failed: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    const baseUrl = new URL(url).origin;
    const imageUrl = extractBestImage($, baseUrl, [
      ".news-detail",
      ".press-release-content",
      ".module_body",
      "article",
    ]);

    $(
      "nav, footer, header, script, style, .sidebar, .cookie-banner, .module_pager"
    ).remove();

    const content =
      $(
        ".module_body, .news-detail, .press-release-content, article, .detail-body, main"
      )
        .first()
        .text()
        .trim() || $("body").text().trim();

    return {
      content: content.replace(/\s+/g, " ").slice(0, 10000),
      imageUrl,
    };
  }
}
