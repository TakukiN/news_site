"use client";

import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

interface CrawlStatusData {
  siteId: number;
  siteName: string;
  lastCrawl: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    newArticles: number;
    articlesFound: number;
    errorMessage: string | null;
  } | null;
}

export default function CrawlStatus({
  statusList,
}: {
  statusList: CrawlStatusData[];
}) {
  if (statusList.length === 0) {
    return (
      <div className="text-sm text-gray-500 bg-white rounded-lg border border-gray-200 p-4">
        巡回履歴がありません。「今すぐ巡回」ボタンで初回巡回を実行してください。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {statusList.map((item) => (
        <div
          key={item.siteId}
          className="bg-white rounded-lg border border-gray-200 p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">
              {item.siteName}
            </span>
            {item.lastCrawl && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  item.lastCrawl.status === "success"
                    ? "bg-green-100 text-green-800"
                    : item.lastCrawl.status === "partial"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {item.lastCrawl.status === "success"
                  ? "成功"
                  : item.lastCrawl.status === "partial"
                  ? "一部エラー"
                  : "エラー"}
              </span>
            )}
          </div>
          {item.lastCrawl ? (
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                最終巡回:{" "}
                {formatDistanceToNow(new Date(item.lastCrawl.startedAt), {
                  addSuffix: true,
                  locale: ja,
                })}
              </p>
              <p>
                検出: {item.lastCrawl.articlesFound}件 / 新着:{" "}
                {item.lastCrawl.newArticles}件
              </p>
              {item.lastCrawl.errorMessage && (
                <p className="text-red-500 truncate" title={item.lastCrawl.errorMessage}>
                  {item.lastCrawl.errorMessage}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">未巡回</p>
          )}
        </div>
      ))}
    </div>
  );
}
