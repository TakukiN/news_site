# 競合サイト巡回・記事要約システム 機能仕様書

## 1. システム概要

競合企業のプレスリリース/ニュースページを定期巡回し、新規・更新記事を検出、AI要約を生成してダッシュボードに表示するWebアプリケーション。

### 1.1 対象サイト（初期）

| 企業 | URL | 取得方式 |
|------|-----|----------|
| Honeywell | `honeywell.com/us/en/press` | Swiftype API (POST) or Headless Browser |
| Zebra | `zebra.com/.../press-releases.html` | HTTP GET + HTML Parse |
| Datalogic | `datalogic.com/.../press-releases-nw-7.html` | HTTP GET + HTML Parse |

### 1.2 サイト構造分析結果

| 項目 | Honeywell | Zebra | Datalogic |
|------|-----------|-------|-----------|
| レンダリング | Client-side JS (Swiftype API) | Server-side (AEM) | Server-side + Client-side pagination |
| 単純HTTPで取得可能 | No | Yes | Yes |
| 一覧ページに日付あり | Yes (API) | No (URLから年のみ) | Yes (h3テキスト内) |
| 一覧ページに要約あり | Yes (API) | No | Yes (pテキスト) |
| スクレイピング難易度 | 高 | 低 | 低 |

---

## 2. 機能一覧

### 2.1 コア機能

| ID | 機能名 | 概要 | 優先度 |
|----|--------|------|--------|
| F-001 | サイト巡回（クローラー） | 登録サイトを定期巡回し記事一覧を取得 | P0 |
| F-002 | 新規記事検出 | 前回巡回時との差分を検出 | P0 |
| F-003 | 記事本文取得 | 記事詳細ページから本文を取得 | P0 |
| F-004 | AI要約生成 | 取得した記事本文をAIで要約 | P0 |
| F-005 | ダッシュボード表示 | 新着記事・要約を一覧表示 | P0 |
| F-006 | 巡回サイト管理 | 対象サイトの追加・編集・削除 | P1 |
| F-007 | 手動巡回トリガー | 任意タイミングでの即時巡回 | P1 |
| F-008 | 通知機能 | 新規記事検出時にメール/Slack通知 | P2 |
| F-009 | キーワードフィルタ | 関心キーワードでの記事フィルタリング | P2 |
| F-010 | レポート出力 | 期間指定での要約レポート生成 (HTML/PDF) | P2 |

### 2.2 管理機能

| ID | 機能名 | 概要 | 優先度 |
|----|--------|------|--------|
| F-011 | 巡回ステータス監視 | 各サイトの巡回成否・最終巡回日時表示 | P0 |
| F-012 | エラーハンドリング | サイト構造変更検出・アラート | P1 |
| F-013 | 巡回スケジュール設定 | サイトごとの巡回間隔設定 | P1 |

---

## 3. 画面仕様

### 3.1 ダッシュボード画面（メイン）

```
+--------------------------------------------------------------+
|  [ロゴ] 競合ニュースウォッチャー        [手動巡回] [設定]    |
+--------------------------------------------------------------+
|  フィルタ: [全企業 ▼] [期間 ▼] [キーワード検索...]          |
+--------------------------------------------------------------+
|                                                              |
|  ● 新着 3件 (最終巡回: 2026-02-21 09:00)                    |
|                                                              |
|  +----------------------------------------------------------+|
|  | 🔴 Honeywell  2026-02-20                                 ||
|  | タイトル: Honeywell Announces New Warehouse Solution      ||
|  | 要約: Honeywellは倉庫向けの新しいソリューションを発表。   ||
|  |       ピッキング効率を30%向上させるウェアラブル端末...    ||
|  | [元記事を見る] [全文表示]                                 ||
|  +----------------------------------------------------------+|
|  | 🔵 Zebra  2026-02-19                                     ||
|  | タイトル: Zebra Technologies Q4 2025 Results              ||
|  | 要約: Zebraの2025年Q4決算を発表。売上高は前年比...        ||
|  | [元記事を見る] [全文表示]                                 ||
|  +----------------------------------------------------------+|
|  | 🟢 Datalogic  2026-02-18                                 ||
|  | タイトル: Datalogic at EuroShop 2026                      ||
|  | 要約: DatalogicがEuroShop 2026に出展。新型スキャナー...   ||
|  | [元記事を見る] [全文表示]                                 ||
|  +----------------------------------------------------------+|
|                                                              |
|  [もっと読み込む]                                            |
+--------------------------------------------------------------+
```

### 3.2 サイト管理画面

```
+--------------------------------------------------------------+
|  巡回サイト管理                              [+ サイト追加]  |
+--------------------------------------------------------------+
|  | 企業名     | URL          | 巡回間隔 | 最終巡回   | 状態 |
|  |------------|--------------|----------|------------|------|
|  | Honeywell  | honeywell... | 6時間    | 2/21 09:00 | ✅   |
|  | Zebra      | zebra.com... | 6時間    | 2/21 09:00 | ✅   |
|  | Datalogic  | datalogic... | 6時間    | 2/21 09:05 | ✅   |
|  |            |              |          |            |      |
|  [編集] [削除] [今すぐ巡回]                                  |
+--------------------------------------------------------------+
```

### 3.3 サイト追加/編集ダイアログ

入力項目:
- 企業名（表示名）
- ベースURL（一覧ページ）
- 巡回間隔（1時間 / 6時間 / 12時間 / 24時間）
- パーサータイプ（後述のスクレイパー設定）
- 企業カラー（表示用アクセントカラー）

---

## 4. アーキテクチャ

### 4.1 技術スタック

```
Frontend:  Next.js (App Router) + TypeScript + Tailwind CSS
Backend:   Next.js API Routes + Node.js
DB:        SQLite (Prisma ORM) — 小規模のためシンプルに
Crawler:   Playwright (Headless Browser) + Cheerio (HTML Parse)
AI要約:    Claude API (claude-haiku-4-5 — コスト最適化)
Scheduler: node-cron (プロセス内スケジューラー)
```

### 4.2 システム構成図

```
                    ┌─────────────────────┐
                    │   Next.js App       │
                    │  ┌───────────────┐  │
  Browser ─────────►│  │  Frontend     │  │
                    │  │  (React/TW)   │  │
                    │  └───────┬───────┘  │
                    │          │ API       │
                    │  ┌───────▼───────┐  │
                    │  │  API Routes   │  │
                    │  └───────┬───────┘  │
                    │          │           │
                    │  ┌───────▼───────┐  │
                    │  │  Crawler      │  │─────► 競合サイト群
                    │  │  Engine       │  │
                    │  └───────┬───────┘  │
                    │          │           │
                    │  ┌───────▼───────┐  │
                    │  │  Claude API   │  │─────► Anthropic API
                    │  │  (要約生成)    │  │
                    │  └───────┬───────┘  │
                    │          │           │
                    │  ┌───────▼───────┐  │
                    │  │  SQLite DB    │  │
                    │  │  (Prisma)     │  │
                    │  └───────────────┘  │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │  node-cron    │  │
                    │  │  Scheduler    │  │
                    │  └───────────────┘  │
                    └─────────────────────┘
```

### 4.3 データベーススキーマ

```sql
-- 巡回対象サイト
CREATE TABLE sites (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,           -- 企業名
  url           TEXT NOT NULL,           -- 一覧ページURL
  color         TEXT DEFAULT '#6B7280',  -- 表示用カラーコード
  parser_type   TEXT NOT NULL,           -- 'cheerio' | 'playwright' | 'api'
  parser_config TEXT,                    -- JSON: サイト固有のパーサー設定
  cron_interval TEXT DEFAULT '0 */6 * * *', -- 巡回スケジュール (cron式)
  is_active     INTEGER DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 巡回ログ
CREATE TABLE crawl_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       INTEGER NOT NULL REFERENCES sites(id),
  status        TEXT NOT NULL,           -- 'success' | 'error' | 'partial'
  articles_found INTEGER DEFAULT 0,
  new_articles  INTEGER DEFAULT 0,
  error_message TEXT,
  started_at    DATETIME NOT NULL,
  finished_at   DATETIME,
  duration_ms   INTEGER
);

-- 記事
CREATE TABLE articles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       INTEGER NOT NULL REFERENCES sites(id),
  external_url  TEXT NOT NULL UNIQUE,    -- 記事の元URL（重複検出キー）
  title         TEXT NOT NULL,
  published_at  DATETIME,
  raw_content   TEXT,                    -- 取得した本文 (HTML除去済み)
  summary_ja    TEXT,                    -- AI生成の日本語要約
  summary_en    TEXT,                    -- AI生成の英語要約（オプション）
  is_new        INTEGER DEFAULT 1,      -- 未読フラグ
  detected_at   DATETIME DEFAULT CURRENT_TIMESTAMP, -- 検出日時
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- キーワードアラート (P2)
CREATE TABLE keywords (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword       TEXT NOT NULL,
  is_active     INTEGER DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. クローラー設計

### 5.1 パーサー抽象化

サイトごとに取得方式が異なるため、パーサーをプラガブル設計にする。

```typescript
interface SiteParser {
  // 一覧ページから記事メタデータを取得
  fetchArticleList(site: Site): Promise<ArticleMeta[]>;
  // 個別記事の本文を取得
  fetchArticleContent(url: string): Promise<string>;
}

interface ArticleMeta {
  externalUrl: string;   // 記事URL (一意キー)
  title: string;
  publishedAt?: Date;
  snippet?: string;      // 一覧ページ上の概要テキスト
}
```

### 5.2 サイト別パーサー実装

| サイト | パーサー | 方式詳細 |
|--------|----------|----------|
| Honeywell | `HoneywellParser` | Swiftype Search API にPOSTリクエスト。APIが不安定な場合はPlaywrightフォールバック |
| Zebra | `ZebraParser` | HTTP GET → Cheerioで `article` 要素をパース。日付は個別記事ページから取得 |
| Datalogic | `DatalogicParser` | HTTP GET → Cheerioで `div#news-list > div.list-col` をパース。全件が1リクエストで取得可能 |

### 5.3 巡回フロー

```
[Scheduler Trigger]
       │
       ▼
  ① 一覧ページ取得 (fetchArticleList)
       │
       ▼
  ② DB照合 → external_url で既知記事を除外
       │
       ▼
  ③ 新規記事のみ: 本文取得 (fetchArticleContent)
       │ ※ rate limit: 1記事/2秒
       ▼
  ④ AI要約生成 (Claude API)
       │ ※ バッチ処理: 最大5記事/回
       ▼
  ⑤ DB保存 + 通知トリガー
       │
       ▼
  ⑥ 巡回ログ記録
```

### 5.4 レート制限・礼儀

- 同一ドメインへのリクエスト間隔: **最低2秒**
- robots.txt を尊重（初回巡回時に取得・キャッシュ）
- User-Agent: `CompetitorWatch/1.0 (internal research tool)`
- 1回の巡回で取得する新規記事数の上限: **20件**（初回は最新50件）

---

## 6. AI要約仕様

### 6.1 要約プロンプト

```
あなたは競合企業のプレスリリースを分析するビジネスアナリストです。
以下の記事を日本語で要約してください。

要約のルール:
- 3〜5文で簡潔にまとめる
- 製品名・技術名は原語のまま記載
- ビジネスインパクト（数値・市場・戦略）があれば必ず含める
- 推測は含めず、記事に記載された事実のみ

記事タイトル: {title}
記事本文:
{content}
```

### 6.2 要約モデル設定

| 項目 | 値 |
|------|-----|
| モデル | claude-haiku-4-5 (コスト最適化) |
| max_tokens | 500 |
| temperature | 0.3 |
| 言語 | 日本語 |
| 1記事あたりの推定コスト | ~$0.001 |

---

## 7. 新規サイト追加の拡張方法

新しい競合サイトを追加する手順:

1. **サイト分析**: 対象サイトの一覧ページ構造を確認
2. **パーサー実装**: `SiteParser` インタフェースを実装
   ```
   src/lib/parsers/
   ├── base.ts          # SiteParser interface
   ├── honeywell.ts
   ├── zebra.ts
   ├── datalogic.ts
   └── newcompany.ts    ← 追加
   ```
3. **parser_config 定義**: セレクタ情報をJSON設定として定義
   ```json
   {
     "listSelector": "div.article-list > div.item",
     "titleSelector": "h3 a",
     "dateSelector": "span.date",
     "linkSelector": "h3 a[href]",
     "dateFormat": "YYYY-MM-DD"
   }
   ```
4. **DB登録**: サイト管理画面から追加 or SQLで直接登録

### 7.1 汎用パーサー（将来拡張）

よくあるパターン向けの汎用パーサーを用意:

- `GenericCheerioParser`: CSSセレクタ設定のみで動作するHTML用パーサー
- `GenericPlaywrightParser`: JS描画サイト用のヘッドレスブラウザパーサー
- `RSSParser`: RSS/Atomフィード対応パーサー

---

## 8. 非機能要件

| 項目 | 要件 |
|------|------|
| 巡回間隔 | デフォルト6時間、サイト単位で1〜24時間に設定可能 |
| 要約生成時間 | 1記事あたり5秒以内 |
| データ保持期間 | 記事データ: 1年、巡回ログ: 3ヶ月 |
| 同時巡回サイト数 | 最大10サイト（直列実行、サイト間は並列可） |
| エラー耐性 | 1サイト障害時も他サイトの巡回は継続 |
| セキュリティ | APIキーは環境変数管理、管理画面はBasic認証 |

---

## 9. 開発フェーズ

### Phase 1: MVP（P0機能）
- クローラーエンジン（3サイト対応）
- 新規記事検出 + DB保存
- AI要約生成
- ダッシュボード表示（一覧 + 要約表示）
- 巡回ステータス表示

### Phase 2: 運用改善（P1機能）
- サイト管理UI（追加・編集・削除）
- 手動巡回トリガー
- エラー検出・アラート
- 巡回スケジュールのカスタマイズ

### Phase 3: 高度化（P2機能）
- Slack/メール通知
- キーワードフィルタ・アラート
- レポート出力（HTML/PDF）
- 汎用パーサー対応

---

## 10. ディレクトリ構成（想定）

```
competitor_sites/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # ダッシュボード
│   │   ├── settings/
│   │   │   └── page.tsx        # サイト管理
│   │   └── api/
│   │       ├── crawl/
│   │       │   └── route.ts    # 手動巡回API
│   │       ├── articles/
│   │       │   └── route.ts    # 記事一覧API
│   │       └── sites/
│   │           └── route.ts    # サイト管理API
│   ├── lib/
│   │   ├── crawler/
│   │   │   ├── engine.ts       # 巡回エンジン
│   │   │   └── scheduler.ts    # node-cron スケジューラー
│   │   ├── parsers/
│   │   │   ├── base.ts         # SiteParser interface
│   │   │   ├── honeywell.ts
│   │   │   ├── zebra.ts
│   │   │   └── datalogic.ts
│   │   ├── summarizer/
│   │   │   └── claude.ts       # Claude API 要約
│   │   └── db/
│   │       └── prisma.ts       # Prisma client
│   └── components/
│       ├── Dashboard.tsx
│       ├── ArticleCard.tsx
│       ├── SiteManager.tsx
│       └── CrawlStatus.tsx
├── .env.local                  # ANTHROPIC_API_KEY etc.
├── package.json
└── README.md
```
