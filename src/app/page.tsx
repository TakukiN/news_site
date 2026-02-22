"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import ArticleCard from "@/components/ArticleCard";
import FilterBar from "@/components/FilterBar";
import { useProgress } from "@/components/ProgressContext";

interface Article {
  id: number;
  title: string;
  externalUrl: string;
  summaryJa: string | null;
  detailSummaryJa: string | null;
  rawContent: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  detectedAt: string;
  isNew: boolean;
  category: string;
  viewCount?: number;
  isFavorited?: boolean;
  likeCount?: number;
  commentCount?: number;
  site: { name: string; color: string };
}

interface CompanyOption {
  name: string;
  color: string;
}

interface Genre {
  id: number;
  name: string;
  slug: string;
  _count: { sites: number };
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-[16/9] bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
        <div className="h-3 bg-gray-200 rounded w-1/4 pt-2" />
      </div>
    </div>
  );
}

function loadFilter(slug: string, key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(`filter_${slug}_${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveFilter(slug: string, key: string, value: string) {
  try {
    localStorage.setItem(`filter_${slug}_${key}`, value);
  } catch { /* ignore */ }
}

export default function Dashboard() {
  return (
    <Suspense>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [genres, setGenres] = useState<Genre[]>([]);
  const [activeGenreSlug, setActiveGenreSlug] = useState<string>("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState("publishedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  const { isCrawling, crawlProgress, startCrawl } = useProgress();

  const activeGenre = genres.find((g) => g.slug === activeGenreSlug);

  const fetchGenres = useCallback(async () => {
    const res = await fetch("/api/genres");
    const data: Genre[] = await res.json();
    setGenres(data);
    return data;
  }, []);

  // Fetch genres on mount
  useEffect(() => {
    (async () => {
      const data = await fetchGenres();
      const urlGenre = searchParams.get("genre");
      const slug = urlGenre && data.find((g) => g.slug === urlGenre)
        ? urlGenre
        : data[0]?.slug || "";
      setActiveGenreSlug(slug);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load filters when genre changes
  useEffect(() => {
    if (!activeGenreSlug) return;
    setSelectedCompany(loadFilter(activeGenreSlug, "company", ""));
    setSelectedCategory(loadFilter(activeGenreSlug, "category", ""));
    setKeyword(loadFilter(activeGenreSlug, "keyword", ""));
    setSortBy(loadFilter(activeGenreSlug, "sortBy", "publishedAt"));
    setSortOrder(loadFilter(activeGenreSlug, "sortOrder", "desc"));
    setFavoritesOnly(loadFilter(activeGenreSlug, "favoritesOnly", "false") === "true");
    setPage(1);
    setFiltersInitialized(true);
  }, [activeGenreSlug]);

  const handleGenreChange = useCallback((slug: string) => {
    setFiltersInitialized(false);
    setActiveGenreSlug(slug);
    router.push(`/?genre=${slug}`, { scroll: false });
  }, [router]);

  const fetchArticles = useCallback(async () => {
    if (!activeGenre || !filtersInitialized) return;
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("genreId", activeGenre.id.toString());
      if (selectedCompany) params.set("companyName", selectedCompany);
      if (selectedCategory) params.set("category", selectedCategory);
      if (keyword) params.set("keyword", keyword);
      params.set("page", page.toString());
      params.set("limit", "20");
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      if (favoritesOnly) params.set("favoritesOnly", "true");

      const res = await fetch(`/api/articles?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setArticles(data.articles);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "記事の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [activeGenre, filtersInitialized, selectedCompany, selectedCategory, keyword, page, sortBy, sortOrder, favoritesOnly]);

  const fetchSites = useCallback(async () => {
    if (!activeGenre) return;
    const res = await fetch(`/api/sites?genreId=${activeGenre.id}`);
    const data = await res.json();
    const companyMap = new Map<string, string>();
    for (const s of data) {
      if (!companyMap.has(s.name)) {
        companyMap.set(s.name, s.color);
      }
    }
    setCompanies(
      Array.from(companyMap.entries()).map(([name, color]) => ({ name, color }))
    );
  }, [activeGenre]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    if (!activeGenreSlug || !filtersInitialized) return;
    setPage(1);
    saveFilter(activeGenreSlug, "company", selectedCompany);
    saveFilter(activeGenreSlug, "category", selectedCategory);
    saveFilter(activeGenreSlug, "keyword", keyword);
    saveFilter(activeGenreSlug, "sortBy", sortBy);
    saveFilter(activeGenreSlug, "sortOrder", sortOrder);
    saveFilter(activeGenreSlug, "favoritesOnly", String(favoritesOnly));
  }, [keyword, selectedCompany, selectedCategory, sortBy, sortOrder, favoritesOnly, activeGenreSlug, filtersInitialized]);

  // Refresh articles when crawl finishes
  useEffect(() => {
    if (!isCrawling && crawlProgress) {
      fetchArticles();
    }
  }, [isCrawling, crawlProgress, fetchArticles]);

  const handleCrawl = async () => {
    await startCrawl(activeGenre?.id);
  };

  const handleMarkRead = async (articleId: number) => {
    fetch("/api/articles/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId }),
    }).catch(() => {});

    await fetch("/api/articles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleIds: [articleId], isNew: false }),
    });
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, isNew: false } : a))
    );
  };

  const handleFavorite = async (articleId: number) => {
    try {
      const res = await fetch("/api/articles/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      if (res.ok) {
        const data = await res.json();
        setArticles((prev) =>
          prev.map((a) => (a.id === articleId ? { ...a, isFavorited: data.isFavorited } : a))
        );
      }
    } catch { /* ignore */ }
  };

  const handleLike = async (articleId: number) => {
    try {
      const res = await fetch("/api/articles/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      if (res.ok) {
        const data = await res.json();
        setArticles((prev) =>
          prev.map((a) => (a.id === articleId ? { ...a, likeCount: data.likeCount } : a))
        );
      }
    } catch { /* ignore */ }
  };

  const handleExportCSV = async () => {
    if (!activeGenre) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("genreId", activeGenre.id.toString());
      if (selectedCompany) params.set("companyName", selectedCompany);
      if (selectedCategory) params.set("category", selectedCategory);
      if (keyword) params.set("keyword", keyword);
      params.set("format", "csv");

      const res = await fetch(`/api/articles/export?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `articles_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const newCount = articles.filter((a) => a.isNew).length;

  return (
    <div className="min-h-screen">
      <Header
        onCrawl={handleCrawl}
        isCrawling={isCrawling}
        genres={genres}
        activeGenreSlug={activeGenreSlug}
        onGenreChange={handleGenreChange}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Crawl progress bar */}
        {crawlProgress && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              {isCrawling && (
                <svg className="animate-spin h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <p className="text-sm font-medium text-indigo-800">
                {isCrawling
                  ? `巡回中... ${crawlProgress.current || 0}/${crawlProgress.total || 0} サイト — ${crawlProgress.siteName || ""}`
                  : "巡回完了"}
              </p>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {crawlProgress.log.map((msg, i) => (
                <p key={i} className="text-xs text-indigo-600">{msg}</p>
              ))}
            </div>
          </div>
        )}

        <FilterBar
          companies={companies}
          selectedCompany={selectedCompany}
          selectedCategory={selectedCategory}
          keyword={keyword}
          sortBy={sortBy}
          sortOrder={sortOrder}
          favoritesOnly={favoritesOnly}
          onCompanyChange={setSelectedCompany}
          onCategoryChange={setSelectedCategory}
          onKeywordChange={setKeyword}
          onSortByChange={setSortBy}
          onSortOrderChange={setSortOrder}
          onFavoritesOnlyChange={setFavoritesOnly}
        />

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm text-red-700">記事の読み込みに失敗しました: {error}</p>
            <button
              onClick={fetchArticles}
              className="mt-1 text-xs font-medium text-red-600 hover:text-red-800"
            >
              再試行
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {total > 0 ? (
              <>
                全 <span className="font-semibold">{total}</span> 件
                {newCount > 0 && (
                  <span className="ml-2 text-amber-600 font-medium">
                    (新着 {newCount}件)
                  </span>
                )}
              </>
            ) : loading ? (
              "読み込み中..."
            ) : (
              "記事がありません。「今すぐ巡回」で記事を取得してください。"
            )}
          </p>
          {total > 0 && (
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {exporting ? "エクスポート中..." : "CSV出力"}
            </button>
          )}
        </div>

        {/* Skeleton loading */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onMarkRead={handleMarkRead}
                onFavorite={handleFavorite}
                onLike={handleLike}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              前へ
            </button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              次へ
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
