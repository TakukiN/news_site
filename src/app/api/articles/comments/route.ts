import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const articleId = request.nextUrl.searchParams.get("articleId");
  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 });
  }

  const comments = await prisma.articleComment.findMany({
    where: { articleId: parseInt(articleId) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comments);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { articleId, text } = body;

  if (!articleId || !text?.trim()) {
    return NextResponse.json(
      { error: "articleId and text required" },
      { status: 400 }
    );
  }

  const comment = await prisma.articleComment.create({
    data: {
      articleId: parseInt(articleId),
      text: text.trim(),
    },
  });

  return NextResponse.json(comment);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const commentId = body?.commentId;

  if (!commentId) {
    return NextResponse.json({ error: "commentId required" }, { status: 400 });
  }

  await prisma.articleComment.delete({
    where: { id: parseInt(commentId) },
  });

  return NextResponse.json({ success: true });
}
