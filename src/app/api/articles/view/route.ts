import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const articleId = body?.articleId;

  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 });
  }

  await prisma.articleView.create({
    data: { articleId: parseInt(articleId) },
  });

  return NextResponse.json({ success: true });
}
