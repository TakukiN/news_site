import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

interface DetectResult {
  parserType: string;
  parserConfig: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  description: string;
  siteName?: string;
}

/**
 * POST /api/sites/detect
 * Auto-detect parserType and generate parserConfig from a URL.
 */
export async function POST(request: NextRequest) {
  const { url } = await request.json();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const result = await detectSite(url);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Detection failed: ${e}` },
      { status: 500 }
    );
  }
}

async function detectSite(url: string): Promise<DetectResult> {
  const parsedUrl = new URL(url);
  const origin = parsedUrl.origin;

  // 1. YouTube
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return {
      parserType: "youtube",
      parserConfig: {},
      confidence: "high",
      description: "YouTube チャンネル（RSS フィード経由）",
      siteName: extractNameFromDomain(parsedUrl),
    };
  }

  // 2. RSS/Atom feed (by extension)
  if (/\.(xml|rss|atom)(\?|$)/i.test(url) || /\/feed\/?$/i.test(url)) {
    return {
      parserType: "rss",
      parserConfig: {},
      confidence: "high",
      description: "RSS/Atom フィード",
      siteName: extractNameFromDomain(parsedUrl),
    };
  }

  // 3. Fetch the page
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get("content-type") || "";

  // 3a. JSON API response
  if (contentType.includes("application/json")) {
    return {
      parserType: "api-json",
      parserConfig: {
        baseUrl: origin,
        api: { url, method: "GET", responseType: "json" },
        mapping: { url: "url", title: "title" },
        content: { selectors: ["article", "main", ".content"] },
      },
      confidence: "medium",
      description: "JSON API レスポンス検出",
      siteName: extractNameFromDomain(parsedUrl),
    };
  }

  // 3b. RSS/Atom content
  const text = await res.text();
  if (
    contentType.includes("xml") ||
    text.trimStart().startsWith("<?xml") ||
    text.includes("<rss") ||
    text.includes("<feed")
  ) {
    return {
      parserType: "rss",
      parserConfig: {},
      confidence: "high",
      description: "RSS/Atom フィード",
      siteName: extractNameFromDomain(parsedUrl),
    };
  }

  const $ = cheerio.load(text);
  const siteName = extractSiteName($, parsedUrl);

  // 4. WordPress detection
  const wpResult = await detectWordPress($, origin);
  if (wpResult) return { ...wpResult, siteName };

  // 5. Detect RSS link in HTML
  const rssLink =
    $('link[type="application/rss+xml"]').attr("href") ||
    $('link[type="application/atom+xml"]').attr("href");
  if (rssLink) {
    const rssUrl = rssLink.startsWith("http")
      ? rssLink
      : new URL(rssLink, origin).toString();
    return {
      parserType: "rss",
      parserConfig: { rssUrl },
      confidence: "high",
      description: `RSS フィード検出: ${rssUrl}`,
      siteName,
    };
  }

  // 6. Auto-detect cheerio-list selectors
  const cheerioConfig = detectCheerioSelectors($, url, origin);
  return { ...cheerioConfig, siteName };
}

/** Extract site name from HTML meta tags / title */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSiteName($: any, parsedUrl: URL): string {
  // 1. og:site_name is the most reliable
  const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim();
  if (ogSiteName) return ogSiteName;

  // 2. application-name meta
  const appName = $('meta[name="application-name"]').attr("content")?.trim();
  if (appName) return appName;

  // 3. <title> tag — often "Page Title | Site Name" or "Page Title - Site Name"
  const title = $("title").text().trim();
  if (title) {
    // Try to extract site name from separator patterns
    for (const sep of [" | ", " - ", " – ", " — ", " :: ", " » "]) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        // Site name is usually the last part
        const last = parts[parts.length - 1].trim();
        if (last.length >= 2 && last.length <= 40) return last;
      }
    }
    // If title is short enough, use it as-is
    if (title.length <= 40) return title;
  }

  // 4. Fallback: domain name
  return extractNameFromDomain(parsedUrl);
}

/** Fallback: derive a readable name from the domain */
function extractNameFromDomain(parsedUrl: URL): string {
  const host = parsedUrl.hostname.replace(/^www\./, "");
  // Remove TLD for cleaner name, e.g. "example.com" -> "example"
  const parts = host.split(".");
  if (parts.length >= 2) {
    return parts.slice(0, -1).join(".");
  }
  return host;
}

async function detectWordPress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $: any,
  origin: string
): Promise<DetectResult | null> {
  // Check meta generator tag
  const generator = $('meta[name="generator"]').attr("content") || "";
  const isWP =
    generator.toLowerCase().includes("wordpress") ||
    $('link[href*="wp-content"]').length > 0 ||
    $('script[src*="wp-includes"]').length > 0;

  if (!isWP) return null;

  // Try to find WP REST API
  const wpApiLink = $('link[rel="https://api.w.org/"]').attr("href");
  const apiBase = wpApiLink || `${origin}/wp-json/wp/v2`;

  // Try common post types
  for (const postType of ["posts", "blog", "news", "articles"]) {
    try {
      const testUrl = `${apiBase}/${postType}?per_page=1`;
      const testRes = await fetch(testUrl, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (testRes.ok) {
        const data = await testRes.json();
        if (Array.isArray(data) && data.length > 0) {
          return {
            parserType: "wordpress",
            parserConfig: {
              apiUrl: `${apiBase}/${postType}`,
              perPage: 100,
              content: {
                selectors: [
                  ".entry-content",
                  ".post-content",
                  "article",
                  "main",
                ],
              },
            },
            confidence: "high",
            description: `WordPress REST API 検出 (${postType})`,
          };
        }
      }
    } catch {
      // continue trying
    }
  }

  return null;
}

interface SelectorCandidate {
  itemSelector: string;
  linkSelector: string;
  titleSelector: string;
  dateSelector?: string;
  imageSelector?: string;
  descriptionSelector?: string;
  score: number;
  count: number;
}

function detectCheerioSelectors(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $: any,
  url: string,
  origin: string
): DetectResult {
  const candidates: SelectorCandidate[] = [];

  // Strategy 1: Find repeated list structures with links
  const listPatterns = [
    // Common news list patterns
    { container: "ul", item: "li" },
    { container: "ol", item: "li" },
    { container: "div", item: "article" },
    { container: "div", item: "div" },
    { container: "section", item: "article" },
    { container: "section", item: "div" },
  ];

  for (const { container, item } of listPatterns) {
    $(container).each((_i: number, containerEl: Element) => {
      const $container = $(containerEl);
      const $items = $container.children(item);

      // Need at least 3 repeated items to be a list
      if ($items.length < 3) return;

      // Check if items contain links
      let linksFound = 0;
      $items.each((_j: number, itemEl: Element) => {
        if ($(itemEl).find("a[href]").length > 0) linksFound++;
      });

      if (linksFound < $items.length * 0.6) return;

      // Build selector for this container
      const containerSelector = buildSelector($, containerEl);
      if (!containerSelector) return;

      const itemSelector = `${containerSelector} > ${item}`;

      // Analyze first item to find title, date, image selectors
      const $firstItem = $items.first();
      const analysis = analyzeItem($, $firstItem, origin);

      if (!analysis.titleSelector) return;

      const score = calculateScore(
        $items.length,
        analysis,
        containerSelector
      );

      candidates.push({
        itemSelector,
        linkSelector: analysis.linkSelector || "a",
        titleSelector: analysis.titleSelector,
        dateSelector: analysis.dateSelector,
        imageSelector: analysis.imageSelector,
        descriptionSelector: analysis.descriptionSelector,
        score,
        count: $items.length,
      });
    });
  }

  // Strategy 2: Find links with common news URL patterns
  if (candidates.length === 0) {
    const newsPatterns = [
      /\/news\//,
      /\/press/,
      /\/article/,
      /\/blog\//,
      /\/post\//,
      /\/info\//,
      /\/topics\//,
    ];

    const newsLinks: string[] = [];
    $("a[href]").each((_i: number, el: Element) => {
      const href = $(el).attr("href") || "";
      if (newsPatterns.some((p) => p.test(href))) {
        newsLinks.push(href);
      }
    });

    if (newsLinks.length >= 3) {
      // Find common parent
      const commonPattern = findCommonUrlPattern(newsLinks);
      candidates.push({
        itemSelector: "a",
        linkSelector: "self",
        titleSelector: "",
        score: 20,
        count: newsLinks.length,
        ...(commonPattern
          ? { linkFilterPattern: commonPattern } as Record<string, string>
          : {}),
      });
    }
  }

  // Sort by score, pick best
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (best && best.score >= 30) {
    const config: Record<string, unknown> = {
      baseUrl: origin,
      list: {
        itemSelector: best.itemSelector,
        linkSelector: best.linkSelector,
        titleSelector: best.titleSelector,
        ...(best.dateSelector ? { dateSelector: best.dateSelector } : {}),
        ...(best.imageSelector ? { imageSelector: best.imageSelector } : {}),
        ...(best.descriptionSelector
          ? { descriptionSelector: best.descriptionSelector }
          : {}),
      },
      content: {
        selectors: detectContentSelectors($),
      },
    };

    return {
      parserType: "cheerio-list",
      parserConfig: config,
      confidence: best.score >= 60 ? "high" : "medium",
      description: `HTML記事リスト検出 (${best.count}件, セレクター: ${best.itemSelector})`,
    };
  }

  // Fallback: basic cheerio-list with minimal config
  return {
    parserType: "cheerio-list",
    parserConfig: {
      baseUrl: origin,
      list: {
        itemSelector: "article, .post, .news-item, .entry, li",
        linkSelector: "a",
        titleSelector: "h2, h3, h4, .title, .heading",
      },
      content: {
        selectors: detectContentSelectors($),
      },
    },
    confidence: "low",
    description:
      "汎用セレクターを設定しました。巡回結果を見て調整が必要な場合があります。",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSelector($: any, el: Element): string | null {
  const $el = $(el);

  // Prefer ID
  const id = $el.attr("id");
  if (id) return `#${id}`;

  // Use class combo
  const classes = ($el.attr("class") || "")
    .split(/\s+/)
    .filter((c: string) => c && !c.match(/^(js-|is-|has-|active|open|show)/))
    .slice(0, 2);

  if (classes.length > 0) {
    const selector = `${el.tagName}.${classes.join(".")}`;
    if ($(selector).length <= 3) return selector;
    // If too many matches, just use first class
    return `${el.tagName}.${classes[0]}`;
  }

  return null;
}

function analyzeItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $item: any,
  _origin: string
): {
  linkSelector?: string;
  titleSelector?: string;
  dateSelector?: string;
  imageSelector?: string;
  descriptionSelector?: string;
} {
  const result: ReturnType<typeof analyzeItem> = {};

  // Find link
  const $links = $item.find("a[href]");
  if ($links.length === 1) {
    result.linkSelector = "a";
  } else if ($links.length > 1) {
    // Try to find the main link (usually the first one or one wrapping a heading)
    const $headingLink = $item.find("a h1, a h2, a h3, a h4, a h5, a h6").parent("a");
    if ($headingLink.length > 0) {
      result.linkSelector = "a:has(h1, h2, h3, h4, h5, h6)";
    } else {
      result.linkSelector = "a";
    }
  }

  // Find title: headings first, then prominent text elements
  const titleCandidates = [
    "h1", "h2", "h3", "h4", "h5", "h6",
    ".title", ".heading", ".tit", ".name",
    "[class*='title']", "[class*='heading']",
  ];
  for (const sel of titleCandidates) {
    const $t = $item.find(sel);
    if ($t.length > 0 && $t.text().trim().length > 5) {
      result.titleSelector = sel;
      break;
    }
  }

  // Find date: elements with date-like text
  const dateCandidates = [
    ".date", ".time", ".published", ".post-date",
    "[class*='date']", "[class*='time']",
    "time", "span.date",
  ];
  for (const sel of dateCandidates) {
    const $d = $item.find(sel);
    if ($d.length > 0) {
      const text = $d.first().text().trim();
      if (looksLikeDate(text)) {
        result.dateSelector = sel;
        break;
      }
    }
  }

  // Also scan all spans/small for date-like content
  if (!result.dateSelector) {
    $item.find("span, small, time, p").each((_i: number, el: Element) => {
      if (result.dateSelector) return;
      const text = $(el).text().trim();
      if (looksLikeDate(text) && text.length < 30) {
        const cls = $(el).attr("class");
        if (cls) {
          result.dateSelector = `${el.tagName}.${cls.split(/\s+/)[0]}`;
        } else {
          result.dateSelector = el.tagName;
        }
      }
    });
  }

  // Find image
  const $img = $item.find("img");
  if ($img.length > 0) {
    result.imageSelector = "img";
  } else {
    // Check for background-image
    const $bg = $item.find("[style*='background-image']");
    if ($bg.length > 0) {
      const cls = $bg.attr("class");
      result.imageSelector = cls
        ? `.${cls.split(/\s+/)[0]}`
        : "[style*='background-image']";
    }
  }

  // Find description: paragraph or excerpt-like element
  const descCandidates = [
    ".description", ".excerpt", ".summary", ".txt", ".text",
    "[class*='desc']", "[class*='excerpt']", "[class*='abstract']",
    "p",
  ];
  for (const sel of descCandidates) {
    const $d = $item.find(sel);
    if ($d.length > 0) {
      const text = $d.first().text().trim();
      if (
        text.length > 20 &&
        text !== $item.find(result.titleSelector || "").text().trim()
      ) {
        result.descriptionSelector = sel;
        break;
      }
    }
  }

  return result;
}

function looksLikeDate(text: string): boolean {
  return /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(text) ||
    /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text) ||
    /\d{4}年\d{1,2}月/.test(text) ||
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d/i.test(text);
}

function calculateScore(
  itemCount: number,
  analysis: ReturnType<typeof analyzeItem>,
  _containerSelector: string
): number {
  let score = 0;
  score += Math.min(itemCount * 5, 30); // More items = more likely a list
  if (analysis.titleSelector) score += 25;
  if (analysis.dateSelector) score += 20;
  if (analysis.imageSelector) score += 10;
  if (analysis.descriptionSelector) score += 10;
  if (analysis.linkSelector) score += 15;
  return score;
}

function findCommonUrlPattern(urls: string[]): string | null {
  // Find longest common path prefix
  const paths = urls.map((u) => {
    try {
      return new URL(u, "http://x").pathname;
    } catch {
      return u;
    }
  });

  if (paths.length === 0) return null;

  let common = paths[0];
  for (const p of paths.slice(1)) {
    let i = 0;
    while (i < common.length && i < p.length && common[i] === p[i]) i++;
    common = common.slice(0, i);
  }

  // Trim to last /
  const lastSlash = common.lastIndexOf("/");
  if (lastSlash > 0) {
    return common.slice(0, lastSlash + 1);
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectContentSelectors($: any): string[] {
  const candidates = [
    "article",
    ".article-content",
    ".post-content",
    ".entry-content",
    ".content-body",
    ".news-detail",
    ".detail",
    ".content",
    "main",
  ];

  // Check which ones exist in the page
  const found = candidates.filter((sel) => $(sel).length > 0);
  if (found.length > 0) return [...found, "main"];

  return ["article", ".content", "main"];
}
