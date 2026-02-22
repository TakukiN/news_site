import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, slug, sortOrder } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (slug !== undefined) {
    const existing = await prisma.genre.findUnique({ where: { slug } });
    if (existing && existing.id !== parseInt(id)) {
      return NextResponse.json(
        { error: "このslugは既に使用されています" },
        { status: 409 }
      );
    }
    data.slug = slug;
  }
  if (sortOrder !== undefined) data.sortOrder = sortOrder;

  const genre = await prisma.genre.update({
    where: { id: parseInt(id) },
    data,
  });

  return NextResponse.json(genre);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const genreId = parseInt(id);

  // Delete related articles, crawl logs, then sites, then genre
  await prisma.$transaction(async (tx) => {
    const siteIds = (
      await tx.site.findMany({
        where: { genreId },
        select: { id: true },
      })
    ).map((s) => s.id);

    if (siteIds.length > 0) {
      await tx.articleComment.deleteMany({
        where: { article: { siteId: { in: siteIds } } },
      });
      await tx.articleView.deleteMany({
        where: { article: { siteId: { in: siteIds } } },
      });
      await tx.article.deleteMany({
        where: { siteId: { in: siteIds } },
      });
      await tx.crawlLog.deleteMany({
        where: { siteId: { in: siteIds } },
      });
      await tx.site.deleteMany({
        where: { genreId },
      });
    }

    await tx.genre.delete({ where: { id: genreId } });
  });

  return NextResponse.json({ success: true });
}
