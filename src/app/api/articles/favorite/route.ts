import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const articleId = body?.articleId;

  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 });
  }

  const article = await prisma.article.findUnique({
    where: { id: parseInt(articleId) },
    select: { isFavorited: true },
  });

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const updated = await prisma.article.update({
    where: { id: parseInt(articleId) },
    data: { isFavorited: !article.isFavorited },
    select: { id: true, isFavorited: true },
  });

  return NextResponse.json(updated);
}
