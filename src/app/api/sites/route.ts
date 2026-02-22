import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const sites = await prisma.site.findMany({
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
  const { name, url, color, parserType, parserConfig, cronInterval } = body;

  if (!name || !url || !parserType) {
    return NextResponse.json(
      { error: "name, url, parserType are required" },
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
    },
  });

  return NextResponse.json(site, { status: 201 });
}
