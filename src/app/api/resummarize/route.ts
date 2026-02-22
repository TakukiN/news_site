import { prisma } from "@/lib/db/prisma";
import { summarizeArticle, summarizeProduct } from "@/lib/summarizer/claude";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const onlyMissing = body.onlyMissing ?? true;
  const stream = body.stream ?? false;

  const where: Record<string, unknown> = {
    rawContent: { not: null },
  };

  if (onlyMissing) {
    where.OR = [
      { summaryJa: null },
      { summaryJa: "" },
      { summaryJa: { contains: "取得できな" } },
      { summaryJa: { contains: "失敗" } },
      { summaryJa: { contains: "生成できません" } },
    ];
  }

  const articles = await prisma.article.findMany({
    where,
    include: { site: { select: { parserType: true, parserConfig: true } } },
    orderBy: { id: "asc" },
  });

  if (!stream) {
    let updated = 0;
    let failed = 0;

    for (const article of articles) {
      try {
        const content = article.rawContent || article.title;
        if (content.length < 50) { failed++; continue; }

        const siteConfig = article.site.parserConfig ? JSON.parse(article.site.parserConfig) : {};
        const isProduct =
          article.site.parserType.endsWith("-product") || siteConfig.category === "product";
        const summaryJa = isProduct
          ? await summarizeProduct(article.title, content)
          : await summarizeArticle(article.title, content);

        await prisma.article.update({
          where: { id: article.id },
          data: { summaryJa },
        });
        updated++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ total: articles.length, updated, failed });
  }

  // Streaming mode
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "start", total: articles.length });

      let updated = 0;
      let failed = 0;

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        send({
          type: "progress",
          current: i + 1,
          total: articles.length,
          title: article.title.slice(0, 60),
        });

        try {
          const content = article.rawContent || article.title;
          if (content.length < 50) { failed++; continue; }

          const siteConfig = article.site.parserConfig ? JSON.parse(article.site.parserConfig) : {};
        const isProduct =
          article.site.parserType.endsWith("-product") || siteConfig.category === "product";
          const summaryJa = isProduct
            ? await summarizeProduct(article.title, content)
            : await summarizeArticle(article.title, content);

          await prisma.article.update({
            where: { id: article.id },
            data: { summaryJa },
          });
          updated++;
          send({ type: "article_done", current: i + 1, updated, failed });
        } catch (e) {
          failed++;
          send({ type: "article_error", current: i + 1, title: article.title.slice(0, 60), error: String(e) });
        }
      }

      send({ type: "done", total: articles.length, updated, failed });
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
