import * as cheerio from "cheerio";
import {
  ArticleMeta,
  FetchContentResult,
  SiteParser,
  extractBestImage,
  stripHtml,
} from "./base";

const USER_AGENT =
  "Mozilla/5.0 (compatible; NewsWatcher/1.0)";

interface WordPressConfig {
  apiUrl: string;
  perPage?: number;
  postType?: string;
  content: {
    selectors: string[];
    removeSelectors?: string[];
  };
}

export class WordPressParser implements SiteParser {
  async fetchArticleList(
    _url: string,
    config: Record<string, string>
  ): Promise<ArticleMeta[]> {
    // config is the parsed parserConfig JSON from DB (may have nested objects)
    const cfg = config as unknown as WordPressConfig;
    const perPage = cfg.perPage || 100;
    const apiUrl = `${cfg.apiUrl}?per_page=${perPage}&_embed`;

    const res = await fetch(apiUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok)
      throw new Error(`wordpress fetch failed: ${res.status}`);

    const posts = await res.json();
    const articles: ArticleMeta[] = [];

    for (const post of posts) {
      const title = stripHtml(post.title?.rendered || "").trim();
      const link = post.link;
      if (!title || !link) continue;

      const publishedAt = post.date ? new Date(post.date) : undefined;
      const excerpt = stripHtml(post.excerpt?.rendered || "").trim();

      articles.push({
        externalUrl: link,
        title,
        publishedAt:
          publishedAt && !isNaN(publishedAt.getTime())
            ? publishedAt
            : undefined,
        snippet: excerpt || undefined,
      });
    }

    return articles;
  }

  async fetchArticleContent(url: string): Promise<string | FetchContentResult> {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok)
      throw new Error(`wordpress article fetch failed: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(url).origin;

    const imageUrl = extractBestImage($, baseUrl, [
      ".entry-content",
      ".post-content",
      "article",
    ]);

    $("nav, footer, header, script, style, .sidebar, .cookie-banner").remove();

    const content =
      $(".entry-content, .post-content, article, main")
        .first()
        .text()
        .trim() || $("body").text().trim();

    return {
      content: content.replace(/\s+/g, " ").slice(0, 10000),
      imageUrl,
    };
  }
}
