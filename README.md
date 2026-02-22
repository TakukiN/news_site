# Competitor News Watcher

Webダッシュボードで競合企業のニュース・製品情報を自動巡回し、日本語要約付きで一覧表示するツール。

## Features

- 複数サイトのニュース・製品ページを自動クロール
- ローカルLLM (Ollama) による日本語要約生成
- 記事のお気に入り・いいね・コメント機能
- キーワード検索、企業別・カテゴリ別フィルタ
- 閲覧数・投稿日時・いいね数でソート
- CSV エクスポート
- 巡回サイト管理 UI (/settings)

## Tech Stack

- **Frontend**: Next.js 16 / React 19 / Tailwind CSS v4
- **Database**: Prisma ORM + SQLite
- **Summarizer**: Ollama (qwen3:8b)
- **Scraping**: Cheerio / Playwright

## Quick Start

```bash
# 1. Clone
git clone <repository-url>
cd competitor_sites

# 2. Setup (creates config files, installs deps, runs migrations)
bash scripts/setup.sh

# 3. Start Ollama (required for summarization)
ollama serve &
ollama pull qwen3:8b

# 4. Start dev server
npm run dev
```

Open http://localhost:3000

## Configuration

### Adding monitored sites

1. **Settings UI**: Navigate to `/settings` and add sites with URL and parser type
2. **Seed file**: Edit `prisma/seed.ts` and run `npx tsx prisma/seed.ts`

### Creating custom parsers

1. Copy the template: `cp src/lib/parsers/example.ts src/lib/parsers/my-site.ts`
2. Implement `fetchArticleList()` and `fetchArticleContent()`
3. Create `src/lib/parsers/custom.ts` to register your parsers:

```ts
import { SiteParser } from "./base";
import { MySiteParser } from "./my-site";

export const customParsers: Record<string, SiteParser> = {
  "my-site": new MySiteParser(),
};
```

`index.ts` automatically loads `custom.ts` at runtime — no need to edit `index.ts`.

See `src/lib/parsers/example.ts` for a documented parser template.

### Built-in parsers

| Parser | Description |
|--------|-------------|
| `rss` | Generic RSS 2.0 / Atom feed parser |
| `youtube` | YouTube channel video parser (via RSS feed) |

### Environment variables

Copy `.env.example` to `.env`:

```
DATABASE_URL="file:./dev.db"       # SQLite database path
ANTHROPIC_API_KEY="your-key"       # Optional: Anthropic API key
OLLAMA_BASE_URL="http://localhost:11434"  # Ollama server URL
OLLAMA_MODEL="qwen3:8b"           # LLM model for summarization
```

## Project Structure

```
src/
  app/
    page.tsx              # Dashboard (article list)
    settings/page.tsx     # Site management
    api/
      articles/           # Article CRUD, favorites, likes, comments
      crawl/              # Crawl trigger endpoint
      sites/              # Site management API
  components/
    ArticleCard.tsx       # Article card with summary, actions
    FilterBar.tsx         # Filter/sort controls
    Header.tsx            # Navigation header
  lib/
    parsers/
      base.ts             # Parser interface & utilities
      example.ts          # Parser template
      rss.ts              # RSS/Atom parser
      youtube.ts          # YouTube parser
      index.ts            # Parser registry (auto-loads custom.ts if present)
    crawler/engine.ts     # Crawl orchestration
    summarizer/claude.ts  # LLM summarization via Ollama
prisma/
  schema.prisma           # Database schema
  seed.example.ts         # Site seed data template
```

## License

MIT
