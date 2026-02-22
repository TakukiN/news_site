import { SiteParser } from "./base";
import { RssParser } from "./rss";
import { YouTubeParser } from "./youtube";
import { CheerioListParser } from "./cheerio-list";
import { ApiJsonParser } from "./api-json";
import { WordPressParser } from "./wordpress";
import { PlaywrightListParser } from "./playwright-list";

// Built-in generic parsers
const parsers: Record<string, SiteParser> = {
  rss: new RssParser(),
  youtube: new YouTubeParser(),
  "cheerio-list": new CheerioListParser(),
  "api-json": new ApiJsonParser(),
  wordpress: new WordPressParser(),
  "playwright-list": new PlaywrightListParser(),
};

// Load custom (site-specific) parsers if available
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const custom = require("./custom");
  if (custom.customParsers) {
    Object.assign(parsers, custom.customParsers);
  }
} catch {
  // No custom parsers — that's fine
}

export function getParser(parserType: string, siteName?: string): SiteParser {
  if (parsers[parserType]) return parsers[parserType];
  const nameKey = siteName?.toLowerCase();
  if (nameKey && parsers[nameKey]) return parsers[nameKey];
  throw new Error(`Unknown parser type: ${parserType}`);
}

export type { ArticleMeta, SiteParser } from "./base";
