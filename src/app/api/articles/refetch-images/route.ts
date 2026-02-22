import { prisma } from "@/lib/db/prisma";
import { getParser } from "@/lib/parsers";
import { filterImageUrl } from "@/lib/parsers/base";
import { NextResponse } from "next/server";

export async function POST() {
  // Find articles without images
  const articles = await prisma.article.findMany({
    where: { imageUrl: null },
    include: { site: true },
    orderBy: { detectedAt: "desc" },
    take: 100,
  });

  if (articles.length === 0) {
    return NextResponse.json({ updated: 0, message: "All articles have images" });
  }

  let updated = 0;
  const errors: string[] = [];

  for (const article of articles) {
    try {
      const parser = getParser(article.site.parserType, article.site.name);
      const result = await parser.fetchArticleContent(article.externalUrl);

      let imageUrl: string | undefined;
      if (typeof result !== "string" && result.imageUrl) {
        imageUrl = filterImageUrl(result.imageUrl);
      }

      if (imageUrl) {
        await prisma.article.update({
          where: { id: article.id },
          data: { imageUrl },
        });
        updated++;
        console.log(`[RefetchImages] Updated image for: ${article.title}`);
      }

      // Small delay to avoid overwhelming servers
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      errors.push(`${article.id}: ${e}`);
    }
  }

  return NextResponse.json({
    total: articles.length,
    updated,
    errors: errors.length,
  });
}
