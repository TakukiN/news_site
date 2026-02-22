import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const genreId = searchParams.get("genreId");

  const where: Record<string, unknown> = {};
  if (genreId) where.genreId = parseInt(genreId);

  const sites = await prisma.site.findMany({
    where,
    include: {
      _count: { select: { articles: true } },
      crawlLogs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          status: true,
          startedAt: true,
          finishedAt: true,
          newArticles: true,
          articlesFound: true,
          errorMessage: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(sites);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, url, color, parserType, parserConfig, cronInterval, genreId } = body;

  if (!name || !url || !parserType || !genreId) {
    return NextResponse.json(
      { error: "name, url, parserType, genreId are required" },
      { status: 400 }
    );
  }

  const site = await prisma.site.create({
    data: {
      name,
      url,
      color: color || "#6B7280",
      parserType,
      parserConfig: parserConfig ? JSON.stringify(parserConfig) : null,
      cronInterval: cronInterval || "0 */6 * * *",
      genreId,
    },
  });

  return NextResponse.json(site, { status: 201 });
}
