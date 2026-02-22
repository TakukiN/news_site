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
    const feedUrl = await this.resolveRssFeedUrl(url);

    const res = await fetch(feedUrl, {
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
      `[YouTube] Found ${articles.length} videos from ${feedUrl}`
    );
    return articles;
  }

  /**
   * Convert any YouTube channel URL to the RSS feed URL.
   * Supports: @handle, /channel/ID, /c/name, /user/name, and direct feed URLs.
   */
  private async resolveRssFeedUrl(url: string): Promise<string> {
    // Already a feed URL
    if (url.includes("/feeds/videos.xml")) return url;

    // /channel/UC... URL — channel ID is directly available
    const channelMatch = url.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/);
    if (channelMatch) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`;
    }

    // @handle, /c/name, /user/name, or /shorts variant — need to fetch page to get channel_id
    console.log(`[YouTube] Resolving channel ID from ${url}`);
    const pageUrl = url.replace(/\/(shorts|videos|streams|playlists)\/?$/, "");
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`Failed to resolve YouTube channel: ${res.status}`);

    const html = await res.text();
    const idMatch =
      html.match(/"externalId":"(UC[a-zA-Z0-9_-]+)"/) ||
      html.match(/channel_id=(UC[a-zA-Z0-9_-]+)/);
    if (!idMatch) throw new Error("Could not find YouTube channel ID from page");

    console.log(`[YouTube] Resolved channel ID: ${idMatch[1]}`);
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${idMatch[1]}`;
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
