"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Genre {
  id: number;
  name: string;
  slug: string;
  _count: { sites: number };
}

export default function ManagePage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  // Inline rename
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const fetchGenres = useCallback(async () => {
    const res = await fetch("/api/genres");
    const data: Genre[] = await res.json();
    setGenres(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  const handleAdd = async () => {
    if (!newName.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        fetchGenres();
      }
    } finally {
      setAdding(false);
    }
  };

  const handleRename = async (id: number) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    await fetch(`/api/genres/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim() }),
    });
    setEditingId(null);
    fetchGenres();
  };

  const handleDelete = async (genre: Genre) => {
    const msg = genre._count.sites > 0
      ? `「${genre.name}」には${genre._count.sites}件のサイトがあります。\nジャンルとすべてのサイト・記事を削除しますか？`
      : `ジャンル「${genre.name}」を削除しますか？`;
    if (!confirm(msg)) return;
    await fetch(`/api/genres/${genre.id}`, { method: "DELETE" });
    fetchGenres();
  };

  return (
    <div className="min-h-screen">
      {/* Simple header for manage page (no genre tabs) */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold text-gray-900">
                ニュースウォッチャー
              </Link>
              <nav className="flex gap-4">
                <Link
                  href="/"
                  className="text-sm font-medium px-3 py-2 rounded-md text-gray-500 hover:text-gray-700"
                >
                  ダッシュボード
                </Link>
                <Link
                  href="/settings"
                  className="text-sm font-medium px-3 py-2 rounded-md text-gray-500 hover:text-gray-700"
                >
                  設定
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">ジャンル管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            ジャンルを追加・編集・削除できます。各ジャンルにはサイトと記事が紐付きます。
          </p>
        </div>

        {/* Add genre */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="新しいジャンル名"
            className="flex-1 max-w-sm text-sm border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || adding}
            className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {adding ? "追加中..." : "ジャンルを追加"}
          </button>
        </div>

        {/* Genre list */}
        {loading ? (
          <div className="text-sm text-gray-400">読み込み中...</div>
        ) : genres.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            ジャンルがありません。上のフォームから追加してください。
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    ジャンル名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    サイト数
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {genres.map((genre) => (
                  <tr key={genre.id}>
                    <td className="px-6 py-4">
                      {editingId === genre.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleRename(genre.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(genre.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          className="text-sm border border-indigo-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">
                          {genre.name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {genre._count.sites}件
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <Link
                        href={`/settings?genre=${genre.slug}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        サイト設定
                      </Link>
                      {editingId !== genre.id && (
                        <button
                          onClick={() => {
                            setEditingId(genre.id);
                            setEditingName(genre.name);
                          }}
                          className="text-xs font-medium text-gray-600 hover:text-gray-800"
                        >
                          名前変更
                        </button>
                      )}
                      {genres.length > 1 && (
                        <button
                          onClick={() => handleDelete(genre)}
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                        >
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
