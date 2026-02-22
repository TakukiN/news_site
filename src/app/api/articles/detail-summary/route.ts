import { prisma } from "@/lib/db/prisma";
import { summarizeDetailArticle, summarizeDetailProduct } from "@/lib/summarizer/claude";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { articleId } = await request.json();

  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 });
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      rawContent: true,
      category: true,
      detailSummaryJa: true,
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Return cached detail summary if available
  if (article.detailSummaryJa) {
    return NextResponse.json({ detailSummaryJa: article.detailSummaryJa });
  }

  // Generate detail summary
  const content = article.rawContent || article.title;
  if (!content || content.length < 30) {
    return NextResponse.json({
      error: "記事の本文が不足しているため詳細要約を生成できません",
    }, { status: 422 });
  }

  try {
    const isProduct = article.category === "product";
    const detailSummaryJa = isProduct
      ? await summarizeDetailProduct(article.title, content)
      : await summarizeDetailArticle(article.title, content);

    // Save to DB
    await prisma.article.update({
      where: { id: article.id },
      data: { detailSummaryJa },
    });

    return NextResponse.json({ detailSummaryJa });
  } catch (e) {
    console.error("[DetailSummary] Generation failed:", e);
    return NextResponse.json(
      { error: "詳細要約の生成に失敗しました" },
      { status: 500 }
    );
  }
}
