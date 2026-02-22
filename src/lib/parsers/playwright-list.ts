import * as cheerio from "cheerio";
import {
  ArticleMeta,
  FetchContentResult,
  SiteParser,
  normalizeUrl,
} from "./base";

interface PlaywrightListConfig {
  baseUrl: string;
  waitSelector: string;
  waitTimeout?: number;
  extraWait?: number;

  list: {
    itemSelector: string;
    titleSelector?: string;
    dateSelector?: string;
    imageSelector?: string;
    descriptionSelector?: string;
    linkFilterPattern?: string;
  };

  content: {
    selectors: string[];
    removeSelectors?: string[];
  };
}

async function fetchWithPlaywright(
  url: string,
  waitSelector?: string,
  waitTimeout?: number,
  extraWait?: number
): Promise<string> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: waitTimeout || 30000,
    });

    if (waitSelector) {
      await page
        .waitForSelector(waitSelector, { timeout: waitTimeout || 15000 })
        .catch(() => {
          console.warn(`[playwright-list] waitSelector timeout: ${waitSelector}`);
        });
    }

    await page.waitForTimeout(extraWait || 5000);
    const html = await page.content();
    await context.close();
    return html;
  } finally {
    await browser.close();
  }
}

export class PlaywrightListParser implements SiteParser {
  async fetchArticleList(
    url: string,
    config: Record<string, string>
  ): Promise<ArticleMeta[]> {
    // config is the parsed parserConfig JSON from DB (may have nested objects)
    const cfg = config as unknown as PlaywrightListConfig;
    const baseUrl = cfg.baseUrl || new URL(url).origin;

    const html = await fetchWithPlaywright(
      url,
      cfg.waitSelector,
      cfg.waitTimeout,
      cfg.extraWait
    );
    const $ = cheerio.load(html);
    const articles: ArticleMeta[] = [];
    const seen = new Set<string>();

    $(cfg.list.itemSelector).each((_i, el) => {
      const $item = $(el);

      // Get href: if itemSelector is an <a>, use it directly; otherwise find <a>
      const href = $item.is("a")
        ? $item.attr("href")
        : $item.find("a").first().attr("href");
      if (!href) return;

      if (cfg.list.linkFilterPattern && !href.includes(cfg.list.linkFilterPattern)) return;

      const fullUrl = normalizeUrl(href, baseUrl);
      if (seen.has(fullUrl) || fullUrl === url) return;
      seen.add(fullUrl);

      // Title
      const title = cfg.list.titleSelector
        ? $item.find(cfg.list.titleSelector).text().trim()
        : $item.text().trim();
      if (!title || title.length < 10 || title.length > 300) return;

      // Date
      let publishedAt: Date | undefined;
      if (cfg.list.dateSelector) {
        const dateStr = $item.find(cfg.list.dateSelector).text().trim();
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) publishedAt = d;
        }
      }

      // Image
      let imageUrl: string | undefined;
      if (cfg.list.imageSelector) {
        imageUrl = $item.find(cfg.list.imageSelector).attr("src") || undefined;
      }

      // Description
      const description = cfg.list.descriptionSelector
        ? $item.find(cfg.list.descriptionSelector).text().trim()
        : undefined;

      const snippet = imageUrl
        ? `__IMG__${imageUrl}__${description || ""}`
        : description || undefined;

      articles.push({ externalUrl: fullUrl, title, publishedAt, snippet });
    });

    // Fallback: if primary selector found nothing, try links matching filter
    if (articles.length === 0 && cfg.list.linkFilterPattern) {
      $(`a[href*="${cfg.list.linkFilterPattern}"]`).each((_i, el) => {
        const $a = $(el);
        const href = $a.attr("href") || "";
        const fullUrl = normalizeUrl(href, baseUrl);
        if (seen.has(fullUrl) || fullUrl === url) return;
        seen.add(fullUrl);

        const title = $a.text().trim();
        if (title.length < 15 || title.length > 300) return;

        articles.push({ externalUrl: fullUrl, title });
      });
    }

    return articles;
  }

  async fetchArticleContent(url: string): Promise<string | FetchContentResult> {
    const html = await fetchWithPlaywright(url);
    const $ = cheerio.load(html);

    const imageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      undefined;

    $("nav, footer, header, script, style, .sidebar").remove();

    const content =
      $("article, [class*='pressRelease'], .content-area, main")
        .first()
        .text()
        .trim() || $("body").text().trim();

    return {
      content: content.replace(/\s+/g, " ").slice(0, 10000),
      imageUrl,
    };
  }
}
