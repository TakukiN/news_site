import * as cheerio from "cheerio";
import {
  ArticleMeta,
  FetchContentResult,
  SiteParser,
  extractBestImage,
} from "./base";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

interface ApiJsonConfig {
  baseUrl: string;
  headers?: Record<string, string>;

  api: {
    url: string;
    method: "GET" | "POST";
    queryParams?: Record<string, string>;
    body?: unknown;
    responseType: "json" | "json_html_array";
  };

  mapping: {
    resultsPath?: string;
    url: string;
    title: string;
    description?: string;
    image?: string;
    publishedAt?: string;
  };

  htmlParsing?: {
    linkSelector: string;
    titleSelector: string;
    imageSelector?: string;
    urlExtractAttr?: string;
    urlPattern?: string;
  };

  excludePatterns?: string[];

  content: {
    selectors: string[];
    removeSelectors?: string[];
  };
}

/** Resolve a dot-path like "product_name.raw" against an object */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export class ApiJsonParser implements SiteParser {
  async fetchArticleList(
    url: string,
    config: Record<string, string>
  ): Promise<ArticleMeta[]> {
    // config is the parsed parserConfig JSON from DB (may have nested objects)
    const cfg = config as unknown as ApiJsonConfig;
    const baseUrl = cfg.baseUrl || new URL(url).origin;
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      ...cfg.headers,
    };

    // Build API URL
    let apiUrl = cfg.api.url;
    if (!apiUrl.startsWith("http")) {
      apiUrl = `${baseUrl}${apiUrl.startsWith("/") ? "" : "/"}${apiUrl}`;
    }

    if (cfg.api.queryParams) {
      const u = new URL(apiUrl);
      for (const [k, v] of Object.entries(cfg.api.queryParams)) {
        u.searchParams.set(k, v);
      }
      apiUrl = u.toString();
    }

    const fetchOpts: RequestInit = {
      method: cfg.api.method,
      headers: {
        ...headers,
        ...(cfg.api.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
    };
    if (cfg.api.method === "POST" && cfg.api.body) {
      fetchOpts.body = JSON.stringify(cfg.api.body);
    }

    const res = await fetch(apiUrl, fetchOpts);
    if (!res.ok) throw new Error(`api-json fetch failed: ${res.status}`);

    const data = await res.json();

    if (cfg.api.responseType === "json_html_array") {
      return this.parseHtmlArray(data, cfg, baseUrl);
    }

    return this.parseJsonResults(data, cfg, baseUrl);
  }

  async fetchArticleContent(url: string): Promise<string | FetchContentResult> {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok)
      throw new Error(`api-json article fetch failed: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(url).origin;

    const imageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      undefined;

    $("nav, footer, header, script, style, .sidebar, .cookie-banner, .breadcrumb").remove();

    const productName =
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") || "";

    const description =
      $(".product-description, .product-overview, [class*='description']")
        .first().text().trim() ||
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") || "";

    const specs: string[] = [];
    $("table tr, .spec-row, [class*='spec'] tr").each((_i, el) => {
      const cells = $(el).find("td, th");
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim();
        const value = $(cells[1]).text().trim();
        if (label && value) specs.push(`${label}: ${value}`);
      }
    });

    const parts: string[] = [];
    if (productName) parts.push(`製品名: ${productName}`);
    if (description) parts.push(`説明: ${description}`);
    if (specs.length > 0) parts.push(`仕様:\n${specs.join("\n")}`);

    if (parts.length <= 1) {
      const mainContent =
        $("main, .content-area, article, .product-detail")
          .first().text().trim() || $("body").text().trim();
      parts.push(mainContent);
    }

    return {
      content: parts.join("\n\n").replace(/\s+/g, " ").slice(0, 10000),
      imageUrl: imageUrl?.startsWith("/") ? `${baseUrl}${imageUrl}` : imageUrl,
    };
  }

  private parseJsonResults(
    data: unknown,
    cfg: ApiJsonConfig,
    baseUrl: string
  ): ArticleMeta[] {
    let results: Record<string, unknown>[];

    if (cfg.mapping.resultsPath) {
      results = getByPath(
        data as Record<string, unknown>,
        cfg.mapping.resultsPath
      ) as Record<string, unknown>[];
    } else if (Array.isArray(data)) {
      results = data;
    } else {
      results = (data as Record<string, unknown>).results as Record<string, unknown>[] || [];
    }

    if (!Array.isArray(results)) return [];

    const articles: ArticleMeta[] = [];

    for (const r of results) {
      const rawUrl = String(getByPath(r, cfg.mapping.url) || "");
      if (!rawUrl) continue;

      const articleUrl = rawUrl.startsWith("http")
        ? rawUrl
        : `${baseUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;

      const title = String(getByPath(r, cfg.mapping.title) || "").trim();
      if (!title) continue;

      // Exclude patterns
      if (cfg.excludePatterns?.some((p) => title.toLowerCase().includes(p.toLowerCase()))) {
        continue;
      }

      let publishedAt: Date | undefined;
      if (cfg.mapping.publishedAt) {
        const dateStr = String(getByPath(r, cfg.mapping.publishedAt) || "");
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) publishedAt = d;
        }
      }

      const desc = cfg.mapping.description
        ? String(getByPath(r, cfg.mapping.description) || "")
        : undefined;

      let imageUrl: string | undefined;
      if (cfg.mapping.image) {
        const raw = getByPath(r, cfg.mapping.image);
        if (typeof raw === "string") {
          // Handle JSON-encoded thumbnail arrays
          try {
            const thumbs = JSON.parse(raw);
            if (Array.isArray(thumbs)) {
              const preferred = thumbs.find(
                (t: { target_market?: string[] }) =>
                  t.target_market?.includes("jp") || t.target_market?.includes("us")
              );
              imageUrl = preferred?.url || thumbs[0]?.url;
            }
          } catch {
            imageUrl = raw.startsWith("http")
              ? raw
              : `${baseUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
          }
        }
      }

      const snippet = imageUrl
        ? `__IMG__${imageUrl}__${desc || ""}`
        : desc || undefined;

      articles.push({ externalUrl: articleUrl, title, publishedAt, snippet });
    }

    return articles;
  }

  private parseHtmlArray(
    items: string[],
    cfg: ApiJsonConfig,
    baseUrl: string
  ): ArticleMeta[] {
    if (!Array.isArray(items) || !cfg.htmlParsing) return [];

    const articles: ArticleMeta[] = [];

    for (const html of items) {
      const $ = cheerio.load(html);
      const $link = $(cfg.htmlParsing.linkSelector);
      if (!$link.length) continue;

      // Extract URL
      let articleUrl: string | undefined;
      const attr = cfg.htmlParsing.urlExtractAttr || "href";
      const attrVal = $link.attr(attr) || "";

      if (cfg.htmlParsing.urlPattern) {
        const match = attrVal.match(new RegExp(cfg.htmlParsing.urlPattern));
        if (match) {
          articleUrl = match[1]
            ? `${baseUrl}${match[1]}`
            : undefined;
        }
      } else {
        articleUrl = attrVal.startsWith("http")
          ? attrVal
          : `${baseUrl}${attrVal}`;
      }

      if (!articleUrl) continue;

      const title = $(cfg.htmlParsing.titleSelector).text().trim();
      if (!title) continue;

      // Exclude patterns
      if (cfg.excludePatterns?.some((p) => title.toLowerCase().includes(p.toLowerCase()))) {
        continue;
      }

      let imageUrl: string | undefined;
      if (cfg.htmlParsing.imageSelector) {
        const imgSrc = $(cfg.htmlParsing.imageSelector).attr("src");
        if (imgSrc) {
          imageUrl = imgSrc.startsWith("http") ? imgSrc : `${baseUrl}${imgSrc}`;
        }
      }

      const snippet = imageUrl ? `__IMG__${imageUrl}__` : undefined;

      articles.push({ externalUrl: articleUrl, title, snippet });
    }

    return articles;
  }
}
