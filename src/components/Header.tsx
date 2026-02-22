"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Genre {
  id: number;
  name: string;
  slug: string;
}

export default function Header({
  onCrawl,
  isCrawling,
  genres,
  activeGenreSlug,
  onGenreChange,
}: {
  onCrawl?: () => void;
  isCrawling?: boolean;
  genres?: Genre[];
  activeGenreSlug?: string;
  onGenreChange?: (slug: string) => void;
}) {
  const pathname = usePathname();
  const activeGenre = genres?.find((g) => g.slug === activeGenreSlug);
  const genreQuery = activeGenreSlug ? `?genre=${activeGenreSlug}` : "";

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Genre tabs row */}
      {genres && genres.length > 0 && onGenreChange && (
        <div className="border-b border-gray-100 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                {genres.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => onGenreChange(genre.slug)}
                    className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeGenreSlug === genre.slug
                        ? "bg-indigo-600 text-white"
                        : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
              <Link
                href="/manage"
                className={`shrink-0 ml-3 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  pathname === "/manage"
                    ? "bg-gray-200 text-gray-900"
                    : "text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                }`}
                title="ジャンル管理"
              >
                <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                管理
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main header row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link href={`/${genreQuery}`} className="text-xl font-bold text-gray-900">
              {activeGenre?.name || "ニュースウォッチャー"}
            </Link>
            <nav className="flex gap-4">
              <Link
                href={`/${genreQuery}`}
                className={`text-sm font-medium px-3 py-2 rounded-md ${
                  pathname === "/"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                ダッシュボード
              </Link>
              <Link
                href={`/settings${genreQuery}`}
                className={`text-sm font-medium px-3 py-2 rounded-md ${
                  pathname === "/settings"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                設定
              </Link>
            </nav>
          </div>
          {onCrawl && (
            <button
              onClick={onCrawl}
              disabled={isCrawling}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCrawling ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  巡回中...
                </>
              ) : (
                "今すぐ巡回"
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
