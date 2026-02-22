import * as cheerio from "cheerio";
import { ArticleMeta, FetchContentResult, SiteParser } from "./base";

/**
 * YouTube channel video parser using RSS/Atom feeds.
 *
 * URL format: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 *
 * The site URL should be the RSS feed URL. To find the channel ID:
 *   curl -s "https://www.youtube.com/@ChannelHandle" | grep -oP 'channel_id=[^"&]+'
 */
export class YouTubeParser implements SiteParser {
  async fetchArticleList(
    url: string,
    _config: Record<string, string>
  ): Promise<ArticleMeta[]> {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CompetitorWatch/1.0)",
      },
    });
    if (!res.ok) throw new Error(`YouTube RSS fetch failed: ${res.status}`);

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const articles: ArticleMeta[] = [];

    $("entry").each((_i, el) => {
      const $entry = $(el);
      const videoId = $entry.find("yt\\:videoId").text().trim();
      const title = $entry.find("title").text().trim();
      const published = $entry.find("published").text().trim();
      const thumbnail =
        $entry.find("media\\:thumbnail").attr("url") ||
        (videoId
          ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          : undefined);
      const description = $entry.find("media\\:description").text().trim();

      if (!videoId || !title) return;

      articles.push({
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title,
        publishedAt: published ? new Date(published) : undefined,
        snippet: description
          ? `__IMG__${thumbnail || ""}__${description.slice(0, 300)}`
          : thumbnail || undefined,
      });
    });

    console.log(
      `[YouTube] Found ${articles.length} videos from RSS feed`
    );
    return articles;
  }

  async fetchArticleContent(url: string): Promise<FetchContentResult> {
    // Extract video ID from URL
    const videoIdMatch = url.match(
      /(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    const videoId = videoIdMatch?.[1];

    // Fetch the video page to get description and metadata
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    let title = "";
    let description = "";
    let imageUrl: string | undefined;

    if (res.ok) {
      const html = await res.text();

      // Extract from meta tags
      const $ = cheerio.load(html);
      title =
        $('meta[property="og:title"]').attr("content") ||
        $("title").text().trim() ||
        "";
      description =
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        "";
      imageUrl =
        $('meta[property="og:image"]').attr("content") ||
        (videoId
          ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
          : undefined);
    }

    // Thumbnail fallback
    if (!imageUrl && videoId) {
      imageUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }

    const parts: string[] = [];
    if (title) parts.push(`動画タイトル: ${title}`);
    if (description) parts.push(`説明: ${description}`);

    const content =
      parts.length > 0
        ? parts.join("\n\n").slice(0, 10000)
        : title || "YouTube動画";

    return { content, imageUrl };
  }
}
