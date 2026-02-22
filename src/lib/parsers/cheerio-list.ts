import * as cheerio from "cheerio";
import {
  ArticleMeta,
  FetchContentResult,
  SiteParser,
  normalizeUrl,
  extractBestImage,
} from "./base";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/** Fetch with manual redirect following and cookie persistence to handle sites like source.android.com */
async function fetchWithRedirects(url: string, headers: Record<string, string>, maxRedirects = 10): Promise<Response> {
  let currentUrl = url;
  let cookies = "";
  for (let i = 0; i < maxRedirects; i++) {
    const reqHeaders: Record<string, string> = { ...headers };
    if (cookies) reqHeaders["Cookie"] = cookies;
    const res = await fetch(currentUrl, { headers: reqHeaders, redirect: "manual" });
    // Collect Set-Cookie headers
    const setCookie = res.headers.getSetCookie?.() || [];
    if (setCookie.length > 0) {
      const parsed = setCookie.map(c => c.split(";")[0]).join("; ");
      cookies = cookies ? `${cookies}; ${parsed}` : parsed;
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`Redirect without location header`);
      currentUrl = location.startsWith("http") ? location : new URL(location, currentUrl).toString();
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects for ${url}`);
}

interface CheerioListConfig {
  baseUrl: string;
  headers?: Record<string, string>;

  list: {
    itemSelector: string;
    linkSelector: string;
    titleSelector: string;
    dateSelector?: string;
    imageSelector?: string;
    descriptionSelector?: string;
    linkFilterPattern?: string;
    skipPatterns?: string[];
  };

  pagination?: {
    type: "query" | "path";
    param?: string;
    pathPattern?: string;
    start?: number;
    step?: number;
    maxPages: number;
  };

  content: {
    selectors: string[];
    removeSelectors?: string[];
    titleSelector?: string;
  };
}

export class CheerioListParser implements SiteParser {
  async fetchArticleList(
    url: string,
    config: Record<string, string>
  ): Promise<ArticleMeta[]> {
    // config is the parsed parserConfig JSON from DB (may have nested objects)
    const cfg = config as unknown as CheerioListConfig;
    const baseUrl = cfg.baseUrl || new URL(url).origin;
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      ...cfg.headers,
    };

    const articles: ArticleMeta[] = [];
    const seen = new Set<string>();
    const pages = this.buildPageUrls(url, cfg.pagination);

    for (const pageUrl of pages) {
      const res = await fetchWithRedirects(pageUrl, headers);
      if (!res.ok) {
        if (pageUrl === pages[0])
          throw new Error(`cheerio-list fetch failed: ${res.status}`);
        break;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      let found = 0;

      $(cfg.list.itemSelector).each((_i, el) => {
        const $item = $(el);

        // Extract link
        const $link = cfg.list.linkSelector === "self"
          ? $item
          : $item.find(cfg.list.linkSelector).first();
        const href = $link.attr("href");
        if (!href) return;

        // Apply link filter
        if (cfg.list.linkFilterPattern && !href.includes(cfg.list.linkFilterPattern)) return;

        // Apply skip patterns
        if (cfg.list.skipPatterns?.some((p) => href.includes(p))) return;

        const fullUrl = normalizeUrl(href, baseUrl);
        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        // Extract title
        const title = cfg.list.titleSelector
          ? $item.find(cfg.list.titleSelector).text().trim()
          : $link.text().trim();
        if (!title) return;

        // Extract date
        let publishedAt: Date | undefined;
        if (cfg.list.dateSelector) {
          const dateText = $item.find(cfg.list.dateSelector).text().trim();
          if (dateText) {
            const normalized = dateText.replace(/\./g, "-");
            const d = new Date(normalized);
            if (!isNaN(d.getTime())) publishedAt = d;
          }
        }

        // Extract image
        let imageUrl: string | undefined;
        if (cfg.list.imageSelector) {
          const $img = $item.find(cfg.list.imageSelector).first();
          const src = $img.attr("src") || $img.attr("data-src");
          if (src) {
            imageUrl = normalizeUrl(src, baseUrl);
          } else {
            // Try background-image
            const style = $img.attr("style") || "";
            const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
            if (bgMatch) imageUrl = normalizeUrl(bgMatch[1], baseUrl);
          }
        }

        // Extract description
        let description: string | undefined;
        if (cfg.list.descriptionSelector) {
          description = $item.find(cfg.list.descriptionSelector).text().trim() || undefined;
        }

        // Build snippet with image info
        let snippet: string | undefined;
        if (imageUrl && description) {
          snippet = `__IMG__${imageUrl}__${description}`;
        } else if (imageUrl) {
          snippet = imageUrl;
        } else {
          snippet = description;
        }

        articles.push({ externalUrl: fullUrl, title, publishedAt, snippet });
        found++;
      });

      if (found === 0) break;
    }

    return articles;
  }

  async fetchArticleContent(url: string): Promise<string | FetchContentResult> {
    const res = await fetchWithRedirects(url, { "User-Agent": USER_AGENT });
    if (!res.ok)
      throw new Error(`cheerio-list article fetch failed: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(url).origin;

    // We need config but fetchArticleContent doesn't receive it.
    // Use extractBestImage with broad selectors as fallback.
    const imageUrl = extractBestImage($, baseUrl, [
      "article", ".content", ".detail", ".news-detail", "main",
    ]);

    $("nav, footer, header, script, style, .sidebar, .cookie-banner, .breadcrumb").remove();

    const content =
      $("article, .content, .detail, .news-detail, .entry-content, .post-content, main")
        .first()
        .text()
        .trim() || $("body").text().trim();

    return {
      content: content.replace(/\s+/g, " ").slice(0, 10000),
      imageUrl,
    };
  }

  private buildPageUrls(
    baseUrl: string,
    pagination?: CheerioListConfig["pagination"]
  ): string[] {
    if (!pagination) return [baseUrl];

    const urls: string[] = [];
    const start = pagination.start ?? 1;
    const step = pagination.step ?? 1;

    for (let i = 0; i < pagination.maxPages; i++) {
      const value = start + i * step;

      if (pagination.type === "query") {
        const param = pagination.param || "page";
        const u = new URL(baseUrl);
        if (i === 0 && start <= 1) {
          // First page: use base URL as-is (some sites don't accept page=0 or page=1)
          urls.push(baseUrl);
        } else {
          u.searchParams.set(param, String(value));
          urls.push(u.toString());
        }
      } else if (pagination.type === "path") {
        if (pagination.pathPattern) {
          if (i === 0) {
            urls.push(baseUrl);
          } else {
            urls.push(
              pagination.pathPattern.replace("{n}", String(value))
            );
          }
        }
      }
    }

    return urls.length > 0 ? urls : [baseUrl];
  }
}
