"use client";

import { useState } from "react";

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
  isFavorited?: boolean;
  likeCount?: number;
  commentCount?: number;
  site: {
    name: string;
    color: string;
  };
}

interface Comment {
  id: number;
  text: string;
  createdAt: string;
}

function renderBoldMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-gray-800">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function parseSummary(summaryJa: string | null): { jaTitle: string | null; summary: string | null } {
  if (!summaryJa) return { jaTitle: null, summary: null };
  const titleMatch = summaryJa.match(/タイトル[：:](.+)/);
  const summaryMatch = summaryJa.match(/要約[：:]([\s\S]+)/);
  return {
    jaTitle: titleMatch ? titleMatch[1].trim() : null,
    summary: summaryMatch ? summaryMatch[1].trim() : summaryJa,
  };
}

export default function ArticleCard({
  article,
  onMarkRead,
  onFavorite,
  onLike,
}: {
  article: Article;
  onMarkRead?: (id: number) => void;
  onFavorite?: (id: number) => void;
  onLike?: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [detailSummary, setDetailSummary] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [liking, setLiking] = useState(false);

  const { jaTitle, summary } = parseSummary(article.summaryJa);
  const parsedDetail = parseSummary(article.detailSummaryJa || detailSummary);
  const hasSummary = summary && summary.length > 0;
  const noSummary = !hasSummary || summary.includes("取得できな") || summary.includes("失敗");

  const publishDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const fetchDetailSummary = async () => {
    if (detailSummary || article.detailSummaryJa || detailLoading) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch("/api/articles/detail-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id }),
      });
      const data = await res.json();
      if (res.ok && data.detailSummaryJa) {
        setDetailSummary(data.detailSummaryJa);
      } else {
        setDetailError(data.error || "生成失敗");
      }
    } catch {
      setDetailError("通信エラー");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFavorite) onFavorite(article.id);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liking) return;
    setLiking(true);
    if (onLike) onLike(article.id);
    setTimeout(() => setLiking(false), 500);
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/articles/comments?articleId=${article.id}`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setCommentsLoading(false);
  };

  const handleToggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showComments) {
      setShowComments(true);
      fetchComments();
    } else {
      setShowComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!commentText.trim()) return;
    try {
      const res = await fetch("/api/articles/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id, text: commentText.trim() }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [comment, ...prev]);
        setCommentText("");
      }
    } catch { /* ignore */ }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const res = await fetch("/api/articles/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch { /* ignore */ }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) return;
    if (!hasSummary) return;

    if (!expanded) {
      setExpanded(true);
      fetchDetailSummary();
    } else {
      setExpanded(false);
    }
  };

  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkRead) onMarkRead(article.id);
  };

  const hasDetail = parsedDetail.summary && parsedDetail.summary.length > 0;

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-all hover:shadow-lg group ${
        hasSummary ? "cursor-pointer" : ""
      } ${article.isNew ? "ring-2" : "border-gray-200"}`}
      style={article.isNew ? { borderColor: article.site.color, "--tw-ring-color": article.site.color } as React.CSSProperties : {}}
    >
      {/* Image */}
      <div className="relative aspect-[16/9] bg-gray-100 overflow-hidden">
        {article.imageUrl && !imgError ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${article.site.color}15 0%, ${article.site.color}30 100%)`,
            }}
          >
            <span className="text-3xl opacity-40" style={{ color: article.site.color }}>
              {article.category === "product" ? "📦" : "📰"}
            </span>
            <span
              className="text-sm font-semibold opacity-25 tracking-wider"
              style={{ color: article.site.color }}
            >
              {article.site.name}
            </span>
          </div>
        )}
        {/* Badge overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
            style={{ backgroundColor: article.site.color }}
          >
            {article.site.name}
          </span>
          {article.category === "product" && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow-sm">
              製品
            </span>
          )}
          {article.isNew && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-400 text-amber-900 shadow-sm">
              NEW
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {publishDate && (
          <p className="text-xs text-gray-400 mb-1.5">{publishDate}</p>
        )}

        <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">
          <a href={article.externalUrl} target="_blank" rel="noopener noreferrer">
            {jaTitle || article.title}
          </a>
        </h3>

        {jaTitle && (
          <p className="text-[11px] text-gray-400 mb-1.5 line-clamp-1">
            {article.title}
          </p>
        )}

        {noSummary ? (
          <p className="text-xs text-gray-400 italic mb-3">
            要約なし
          </p>
        ) : hasSummary ? (
          <div className="mb-3">
            {/* Brief summary */}
            <p className={`text-xs text-gray-600 leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>
              {renderBoldMarkdown(summary)}
            </p>
            {!expanded && summary.length > 120 && (
              <span className="text-[11px] text-indigo-500 mt-1 inline-block">
                ...クリックで詳細表示
              </span>
            )}

            {/* Detail summary (shown when expanded) */}
            {expanded && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[11px] font-semibold text-indigo-600 mb-1.5">
                  詳細要約
                </p>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <svg className="animate-spin h-3 w-3 text-indigo-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    詳細要約を生成中...
                  </div>
                ) : detailError ? (
                  <p className="text-xs text-red-400">{detailError}</p>
                ) : hasDetail ? (
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {renderBoldMarkdown(parsedDetail.summary!)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">詳細要約を取得中...</p>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Action bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          {/* Favorite button */}
          <button
            onClick={handleFavorite}
            className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors ${
              article.isFavorited
                ? "text-amber-500 hover:text-amber-600"
                : "text-gray-400 hover:text-amber-500"
            }`}
            title={article.isFavorited ? "お気に入り解除" : "お気に入り"}
          >
            <svg className="w-3.5 h-3.5" fill={article.isFavorited ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>

          {/* Like button */}
          <button
            onClick={handleLike}
            disabled={liking}
            className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors ${
              liking ? "text-rose-500 scale-110" : "text-gray-400 hover:text-rose-500"
            }`}
            title="いいね"
          >
            <svg className="w-3.5 h-3.5" fill={liking ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {(article.likeCount ?? 0) > 0 && (
              <span className="text-[10px] text-gray-500">{article.likeCount}</span>
            )}
          </button>

          {/* Comment button */}
          <button
            onClick={handleToggleComments}
            className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors ${
              showComments ? "text-indigo-600" : "text-gray-400 hover:text-indigo-500"
            }`}
            title="コメント"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {(article.commentCount ?? 0) > 0 && (
              <span className="text-[10px] text-gray-500">{article.commentCount}</span>
            )}
          </button>

          <div className="flex-1" />

          <a
            href={article.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {article.category === "product" ? "製品ページ" : "元記事"} &rarr;
          </a>
          {article.isNew && onMarkRead && (
            <button
              onClick={handleMarkRead}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              既読にする
            </button>
          )}
          {expanded && hasSummary && (
            <button
              onClick={() => setExpanded(false)}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              閉じる
            </button>
          )}
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleAddComment} className="flex gap-2 mb-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="コメントを入力..."
                className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md disabled:opacity-40 transition-colors"
              >
                送信
              </button>
            </form>
            {commentsLoading ? (
              <p className="text-xs text-gray-400">読み込み中...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400">コメントなし</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 group/comment">
                    <div className="flex-1 bg-gray-50 rounded-md px-2.5 py-1.5">
                      <p className="text-xs text-gray-700">{c.text}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(c.createdAt).toLocaleString("ja-JP")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      className="opacity-0 group-hover/comment:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5"
                      title="削除"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
