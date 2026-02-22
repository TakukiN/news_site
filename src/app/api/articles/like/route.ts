import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const articleId = body?.articleId;

  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 });
  }

  const updated = await prisma.article.update({
    where: { id: parseInt(articleId) },
    data: { likeCount: { increment: 1 } },
    select: { id: true, likeCount: true },
  });

  return NextResponse.json(updated);
}
