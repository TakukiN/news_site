"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface CrawlProgress {
  siteName?: string;
  current?: number;
  total?: number;
  log: string[];
}

interface ResummarizeProgress {
  message: string;
  result?: string;
}

interface ProgressContextValue {
  // Crawl
  isCrawling: boolean;
  crawlingGenreId: number | null;
  crawlProgress: CrawlProgress | null;
  crawlQueue: number[];
  startCrawl: (genreId?: number) => void;
  // Resummarize
  isResummarizing: boolean;
  resummarizeProgress: ResummarizeProgress | null;
  startResummarize: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}

function parseSSE(buffer: string, onEvent: (data: Record<string, unknown>) => void): string {
  const lines = buffer.split("\n\n");
  const remainder = lines.pop() || "";
  for (const line of lines) {
    const match = line.match(/^data: (.+)$/);
    if (!match) continue;
    try {
      onEvent(JSON.parse(match[1]));
    } catch {
      // ignore
    }
  }
  return remainder;
}

async function readStream(res: Response, onEvent: (data: Record<string, unknown>) => void) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSSE(buffer, onEvent);
  }
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlingGenreId, setCrawlingGenreId] = useState<number | null>(null);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);
  const [crawlQueue, setCrawlQueue] = useState<number[]>([]);
  const [isResummarizing, setIsResummarizing] = useState(false);
  const [resummarizeProgress, setResummarizeProgress] = useState<ResummarizeProgress | null>(null);

  const isCrawlingRef = useRef(false);

  const executeCrawl = useCallback(async (genreId?: number) => {
    isCrawlingRef.current = true;
    setIsCrawling(true);
    setCrawlingGenreId(genreId ?? null);
    setCrawlProgress({ log: [] });

    try {
      const payload: Record<string, unknown> = { stream: true };
      if (genreId) payload.genreId = genreId;
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await readStream(res, (data) => {
        if (data.type === "progress") {
          setCrawlProgress((prev) => ({
            ...prev!,
            siteName: data.siteName as string,
            current: data.current as number,
            total: data.total as number,
            log: [...(prev?.log || []), `${data.siteName} を巡回中...`],
          }));
        } else if (data.type === "site_done") {
          setCrawlProgress((prev) => ({
            ...prev!,
            log: [
              ...(prev?.log || []),
              `${data.siteName}: ${data.newArticles}件の新着 (${data.articlesFound}件中)`,
            ],
          }));
        } else if (data.type === "site_error") {
          setCrawlProgress((prev) => ({
            ...prev!,
            log: [...(prev?.log || []), `${data.siteName}: エラー`],
          }));
        }
      });
    } catch (e) {
      console.error("Crawl failed:", e);
    } finally {
      setIsCrawling(false);
      isCrawlingRef.current = false;

      // Show completion for a moment, then process next in queue
      setTimeout(() => {
        setCrawlProgress(null);
        setCrawlingGenreId(null);

        // Process next queued genre
        setCrawlQueue((prev) => {
          if (prev.length > 0) {
            const [next, ...rest] = prev;
            // Use setTimeout to avoid state update during render
            setTimeout(() => executeCrawl(next), 100);
            return rest;
          }
          return prev;
        });
      }, 3000);
    }
  }, []);

  const startCrawl = useCallback((genreId?: number) => {
    if (!isCrawlingRef.current) {
      executeCrawl(genreId);
    } else if (genreId != null) {
      // Add to queue if not already queued and not currently crawling this genre
      setCrawlQueue((prev) => {
        if (prev.includes(genreId)) return prev;
        return [...prev, genreId];
      });
    }
  }, [executeCrawl]);

  const startResummarize = useCallback(async () => {
    if (isResummarizing) return;
    setIsResummarizing(true);
    setResummarizeProgress({ message: "準備中..." });

    try {
      const res = await fetch("/api/resummarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyMissing: true, stream: true }),
      });

      await readStream(res, (data) => {
        if (data.type === "start") {
          setResummarizeProgress({ message: `対象: ${data.total}件` });
        } else if (data.type === "progress") {
          setResummarizeProgress({
            message: `${data.current}/${data.total} — ${data.title}`,
          });
        } else if (data.type === "article_done") {
          setResummarizeProgress({
            message: `${data.current} 処理中... (成功: ${data.updated} / 失敗: ${data.failed})`,
          });
        } else if (data.type === "done") {
          setResummarizeProgress({
            message: "",
            result: `完了 — 対象: ${data.total}件 / 成功: ${data.updated}件 / 失敗: ${data.failed}件`,
          });
        }
      });
    } catch {
      setResummarizeProgress({ message: "", result: "再要約の実行に失敗しました。" });
    } finally {
      setIsResummarizing(false);
    }
  }, [isResummarizing]);

  return (
    <ProgressContext.Provider
      value={{
        isCrawling,
        crawlingGenreId,
        crawlProgress,
        crawlQueue,
        startCrawl,
        isResummarizing,
        resummarizeProgress,
        startResummarize,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}
