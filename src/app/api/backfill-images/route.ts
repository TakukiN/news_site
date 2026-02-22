import { prisma } from "@/lib/db/prisma";
import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

export async function POST() {
  const articles = await prisma.article.findMany({
    where: { imageUrl: null },
    select: { id: true, externalUrl: true, title: true },
    orderBy: { id: "asc" },
  });

  let updated = 0;
  let failed = 0;

  for (const article of articles) {
    try {
      const res = await fetch(article.externalUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        failed++;
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const imageUrl =
        $('meta[property="og:image"]').attr("content") ||
        $('meta[name="twitter:image"]').attr("content");

      if (imageUrl) {
        await prisma.article.update({
          where: { id: article.id },
          data: { imageUrl },
        });
        updated++;
        console.log(`[Backfill] ${updated}: ${article.title.slice(0, 50)} -> ${imageUrl.slice(0, 80)}`);
      }

      // Small delay between requests
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      failed++;
      console.error(`[Backfill] Failed for ${article.id}:`, e);
    }
  }

  return NextResponse.json({ total: articles.length, updated, failed });
}
