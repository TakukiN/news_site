"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header({
  onCrawl,
  isCrawling,
}: {
  onCrawl?: () => void;
  isCrawling?: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              競合ニュースウォッチャー
            </Link>
            <nav className="flex gap-4">
              <Link
                href="/"
                className={`text-sm font-medium px-3 py-2 rounded-md ${
                  pathname === "/"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                ダッシュボード
              </Link>
              <Link
                href="/settings"
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
