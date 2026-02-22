"use client";

import { useState, useEffect, useRef } from "react";

interface CompanyOption {
  name: string;
  color: string;
}

export default function FilterBar({
  companies,
  selectedCompany,
  selectedCategory,
  keyword,
  sortBy,
  sortOrder,
  favoritesOnly,
  onCompanyChange,
  onCategoryChange,
  onKeywordChange,
  onSortByChange,
  onSortOrderChange,
  onFavoritesOnlyChange,
}: {
  companies: CompanyOption[];
  selectedCompany: string;
  selectedCategory: string;
  keyword: string;
  sortBy: string;
  sortOrder: string;
  favoritesOnly: boolean;
  onCompanyChange: (companyName: string) => void;
  onCategoryChange: (category: string) => void;
  onKeywordChange: (keyword: string) => void;
  onSortByChange: (sortBy: string) => void;
  onSortOrderChange: (order: string) => void;
  onFavoritesOnlyChange: (value: boolean) => void;
}) {
  const categories = [
    { value: "", label: "すべて" },
    { value: "news", label: "ニュース" },
    { value: "product", label: "製品" },
  ];

  const sortOptions = [
    { value: "publishedAt", label: "投稿日時" },
    { value: "detectedAt", label: "検出日時" },
    { value: "likeCount", label: "いいね数" },
    { value: "favorites", label: "お気に入り" },
    { value: "views_week", label: "閲覧数(週)" },
    { value: "views_month", label: "閲覧数(月)" },
    { value: "views_year", label: "閲覧数(年)" },
  ];

  // Debounced keyword search
  const [localKeyword, setLocalKeyword] = useState(keyword);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalKeyword(keyword);
  }, [keyword]);

  const handleKeywordChange = (value: string) => {
    setLocalKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onKeywordChange(value);
    }, 300);
  };

  const hasFilters = selectedCompany || selectedCategory || keyword || favoritesOnly || sortBy !== "publishedAt" || sortOrder !== "desc";

  const handleReset = () => {
    onCompanyChange("");
    onCategoryChange("");
    onKeywordChange("");
    setLocalKeyword("");
    onSortByChange("publishedAt");
    onSortOrderChange("desc");
    onFavoritesOnlyChange(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-200 p-4">
      <label className="text-sm font-medium text-gray-700">フィルタ:</label>

      {/* Category toggle */}
      <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === cat.value
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Company dropdown */}
      <select
        value={selectedCompany}
        onChange={(e) => onCompanyChange(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <option value="">全企業</option>
        {(companies || []).map((company) => (
          <option key={company.name} value={company.name}>
            {company.name}
          </option>
        ))}
      </select>

      {/* Favorites only toggle */}
      <button
        onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
          favoritesOnly
            ? "bg-amber-50 text-amber-700 border-amber-300"
            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill={favoritesOnly ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        お気に入り
      </button>

      {/* Keyword search (debounced) */}
      <input
        type="text"
        value={localKeyword}
        onChange={(e) => handleKeywordChange(e.target.value)}
        placeholder="キーワード検索..."
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />

      {/* Separator */}
      <div className="w-px h-6 bg-gray-300" />

      {/* Sort */}
      <label className="text-sm font-medium text-gray-700">並び:</label>
      <select
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Sort order toggle */}
      <button
        onClick={() => onSortOrderChange(sortOrder === "desc" ? "asc" : "desc")}
        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        title={sortOrder === "desc" ? "降順" : "昇順"}
      >
        {sortOrder === "desc" ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            降順
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            昇順
          </>
        )}
      </button>

      {/* Reset button */}
      {hasFilters && (
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-md border border-red-200 hover:bg-red-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          リセット
        </button>
      )}
    </div>
  );
}
