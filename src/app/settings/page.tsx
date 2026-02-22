"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import { useProgress } from "@/components/ProgressContext";

interface SiteData {
  id: number;
  name: string;
  url: string;
  color: string;
  parserType: string;
  cronInterval: string;
  isActive: boolean;
  _count: { articles: number };
  crawlLogs: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    newArticles: number;
    articlesFound: number;
    errorMessage: string | null;
  }[];
}

export default function SettingsPage() {
  const [sites, setSites] = useState<SiteData[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const [newSite, setNewSite] = useState({
    name: "",
    url: "",
    color: "#6B7280",
    parserType: "cheerio",
    cronInterval: "0 */6 * * *",
  });
  const [crawlingIds, setCrawlingIds] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("crawlingIds");
      return saved ? new Set(JSON.parse(saved) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [addLoading, setAddLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const { isResummarizing, resummarizeProgress, startResummarize } = useProgress();

  const fetchSites = useCallback(async () => {
    const res = await fetch("/api/sites");
    const data = await res.json();
    setSites(data);
  }, []);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAdd = async () => {
    if (!newSite.name || !newSite.url) return;
    if (!validateUrl(newSite.url)) {
      setUrlError("有効なURLを入力してください（https://...）");
      return;
    }
    setUrlError(null);
    setAddLoading(true);
    try {
      await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSite),
      });
      setNewSite({
        name: "",
        url: "",
        color: "#6B7280",
        parserType: "cheerio",
        cronInterval: "0 */6 * * *",
      });
      setShowAdd(false);
      fetchSites();
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このサイトと関連する記事を全て削除しますか？")) return;
    await fetch(`/api/sites/${id}`, { method: "DELETE" });
    fetchSites();
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    await fetch(`/api/sites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchSites();
  };

  const saveCrawlingIds = (ids: Set<number>) => {
    setCrawlingIds(ids);
    try {
      localStorage.setItem("crawlingIds", JSON.stringify([...ids]));
    } catch { /* ignore */ }
  };

  const handleCrawlSingle = async (siteId: number) => {
    const next = new Set(crawlingIds);
    next.add(siteId);
    saveCrawlingIds(next);
    try {
      await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      await fetchSites();
    } finally {
      const updated = new Set(crawlingIds);
      updated.delete(siteId);
      saveCrawlingIds(updated);
    }
  };

  const toggleErrorDetail = (siteId: number) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            巡回サイト管理
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={startResummarize}
              disabled={isResummarizing}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {isResummarizing ? "再要約中..." : "要約なし記事を再要約"}
            </button>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + サイト追加
            </button>
          </div>
        </div>

        {resummarizeProgress && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <div className="flex items-center gap-2">
              {isResummarizing && (
                <svg className="animate-spin h-4 w-4 text-amber-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <span>
                {resummarizeProgress.result || resummarizeProgress.message}
              </span>
            </div>
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">
              新しいサイトを追加
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  企業名
                </label>
                <input
                  type="text"
                  value={newSite.name}
                  onChange={(e) =>
                    setNewSite({ ...newSite, name: e.target.value })
                  }
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="例: Acme Corp"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={newSite.url}
                  onChange={(e) => {
                    setNewSite({ ...newSite, url: e.target.value });
                    setUrlError(null);
                  }}
                  className={`w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    urlError ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder="https://..."
                />
                {urlError && (
                  <p className="text-xs text-red-500 mt-1">{urlError}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  パーサータイプ
                </label>
                <select
                  value={newSite.parserType}
                  onChange={(e) =>
                    setNewSite({ ...newSite, parserType: e.target.value })
                  }
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="cheerio">Cheerio (HTML)</option>
                  <option value="api">API</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  巡回間隔
                </label>
                <select
                  value={newSite.cronInterval}
                  onChange={(e) =>
                    setNewSite({ ...newSite, cronInterval: e.target.value })
                  }
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="0 * * * *">1時間ごと</option>
                  <option value="0 */6 * * *">6時間ごと</option>
                  <option value="0 */12 * * *">12時間ごと</option>
                  <option value="0 0 * * *">24時間ごと</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  カラー
                </label>
                <input
                  type="color"
                  value={newSite.color}
                  onChange={(e) =>
                    setNewSite({ ...newSite, color: e.target.value })
                  }
                  className="w-16 h-9 border border-gray-300 rounded-md cursor-pointer"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={addLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {addLoading ? "追加中..." : "追加"}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Sites table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  企業名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  巡回間隔
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  記事数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  最終巡回
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状態
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sites.map((site) => {
                const lastCrawl = site.crawlLogs[0];
                const hasError = lastCrawl?.errorMessage;
                const isErrorExpanded = expandedErrors.has(site.id);
                const cronLabel =
                  {
                    "0 * * * *": "1時間",
                    "0 */6 * * *": "6時間",
                    "0 */12 * * *": "12時間",
                    "0 0 * * *": "24時間",
                    "0 0 * * 1": "週1回",
                  }[site.cronInterval] || site.cronInterval;

                return (
                  <tr key={site.id} className={!site.isActive ? "opacity-50" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: site.color }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {site.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 max-w-[200px] truncate">
                      {site.url}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {cronLabel}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {site._count.articles}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {lastCrawl ? (
                        <div>
                          <span>{new Date(lastCrawl.startedAt).toLocaleString("ja-JP")}</span>
                          <span className="block text-gray-400">
                            {lastCrawl.articlesFound}件取得 / {lastCrawl.newArticles}件新規
                          </span>
                        </div>
                      ) : (
                        "未巡回"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {lastCrawl ? (
                        <div>
                          <button
                            onClick={() => hasError && toggleErrorDetail(site.id)}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              lastCrawl.status === "success"
                                ? "bg-green-100 text-green-800"
                                : lastCrawl.status === "partial"
                                ? "bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200"
                                : "bg-red-100 text-red-800 cursor-pointer hover:bg-red-200"
                            }`}
                          >
                            {lastCrawl.status === "success"
                              ? "OK"
                              : lastCrawl.status === "partial"
                              ? "一部"
                              : "NG"}
                            {hasError && (
                              <svg className={`ml-1 w-3 h-3 transition-transform ${isErrorExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                          {isErrorExpanded && hasError && (
                            <div className="mt-2 max-w-xs">
                              <p className="text-[10px] text-red-600 bg-red-50 rounded p-2 max-h-24 overflow-y-auto break-all leading-relaxed">
                                {lastCrawl.errorMessage}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleCrawlSingle(site.id)}
                        disabled={crawlingIds.has(site.id)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                      >
                        {crawlingIds.has(site.id) ? "巡回中..." : "巡回"}
                      </button>
                      <button
                        onClick={() => handleToggle(site.id, site.isActive)}
                        className="text-xs font-medium text-gray-600 hover:text-gray-800"
                      >
                        {site.isActive ? "無効化" : "有効化"}
                      </button>
                      <button
                        onClick={() => handleDelete(site.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-800"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
