export interface ArticleMeta {
  externalUrl: string;
  title: string;
  publishedAt?: Date;
  snippet?: string;
}

export interface FetchContentResult {
  content: string;
  imageUrl?: string;
}

export interface SiteParser {
  fetchArticleList(url: string, config: Record<string, string>): Promise<ArticleMeta[]>;
  fetchArticleContent(url: string): Promise<string | FetchContentResult>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  return new URL(href, baseUrl).toString();
}

/** Filter out generic logo / default OG images that aren't article-specific */
export function isGenericImage(url: string): boolean {
  const lower = url.toLowerCase();
  const patterns = [
    /\/logo\b/,
    /\/common\//,
    /meta_guide/,
    /default[-_]?(image|og|share|thumb)/,
    /og[-_]?image\.(png|jpg|jpeg)/,
    /share[-_]?image/,
    /favicon/,
  ];
  return patterns.some((p) => p.test(lower));
}

/** Return url if it's a real article image, undefined otherwise */
export function filterImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (isGenericImage(url)) return undefined;
  return url;
}

/** Aggressively extract the best image from a Cheerio-loaded page */
export function extractBestImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $: any,
  baseUrl: string,
  contentSelectors: string[] = []
): string | undefined {
  const resolve = (src: string | undefined): string | undefined => {
    if (!src) return undefined;
    src = src.trim();
    if (!src || src.startsWith("data:")) return undefined;
    const full = src.startsWith("http") ? src : `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
    return filterImageUrl(full);
  };

  // 1. OG / Twitter meta images (most reliable)
  const ogImg = resolve($('meta[property="og:image"]').attr("content"));
  if (ogImg) return ogImg;
  const twImg = resolve($('meta[name="twitter:image"]').attr("content"));
  if (twImg) return twImg;

  // 2. Images within content areas
  const contentAreas = [
    ...contentSelectors,
    "article", ".article", ".post-content", ".entry-content",
    ".content-body", ".detail", ".news-detail", "main",
    ".bbs-view-content", ".newsroom_view", ".detailAreaMain",
  ].join(", ");

  const contentImg = $(contentAreas).find("img").filter((_i: number, el: Element) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    // Skip tiny icons, tracking pixels, spacers
    const w = parseInt($(el).attr("width") || "999", 10);
    const h = parseInt($(el).attr("height") || "999", 10);
    if (w < 50 || h < 50) return false;
    if (src.includes("pixel") || src.includes("spacer") || src.includes("icon")) return false;
    return true;
  }).first();

  const contentImgSrc = resolve(
    contentImg.attr("src") || contentImg.attr("data-src") || contentImg.attr("data-lazy-src")
  );
  if (contentImgSrc) return contentImgSrc;

  // 3. Any significant image on the page
  let fallbackImg: string | undefined;
  $("img").each((_i: number, el: Element) => {
    if (fallbackImg) return;
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    const w = parseInt($(el).attr("width") || "999", 10);
    const h = parseInt($(el).attr("height") || "999", 10);
    if (w < 100 || h < 80) return;
    if (src.includes("pixel") || src.includes("spacer") || src.includes("icon") || src.includes("avatar")) return;
    fallbackImg = resolve(src);
  });
  if (fallbackImg) return fallbackImg;

  // 4. Background-image in style attributes
  let bgImg: string | undefined;
  $("[style*='background-image']").each((_i: number, el: Element) => {
    if (bgImg) return;
    const style = $(el).attr("style") || "";
    const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (match) bgImg = resolve(match[1]);
  });
  return bgImg;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
